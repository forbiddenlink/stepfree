// Runs every 15 minutes (GitHub Actions). Idempotent: deterministic _ids, createIfNotExists + patch.
// Outages that vanish from the feed are marked resolved, which builds per-outage history over time.
import {FEEDS, equipmentId, getJson, nyLocalToIso, sanity, validateOutageFeed} from './lib'

async function main(): Promise<void> {
  const client = sanity()
  const now = new Date().toISOString()
  const feed = await getJson<unknown>(FEEDS.outages)
  const knownEquipment = new Set<string>(await client.fetch('*[_type == "equipment"].equipmentNo'))
  // Validate every row before building mutations: a broken snapshot must never mass-resolve outages.
  validateOutageFeed(feed, knownEquipment)
  const seen = new Set<string>()
  const tx = client.transaction()
  let skipped = 0
  for (const row of feed) {
    if (!knownEquipment.has(row.equipment)) {
      skipped++
      continue
    }
    const startsAt = nyLocalToIso(row.outagedate)
    const id = `outage-${row.equipment}-${startsAt ? Date.parse(startsAt) / 1000 : 'unknown'}`
    seen.add(id)
    tx.createIfNotExists({
      _id: id,
      _type: 'outage',
      equipment: {_type: 'reference', _ref: equipmentId(row.equipment)},
      status: 'active',
      startsAt,
      firstSeenAt: now,
    })
    tx.patch(id, (p) =>
      p.set({
        status: row.isupcomingoutage === 'Y' ? 'upcoming' : 'active',
        reason: row.reason,
        isPlannedMaintenance: row.ismaintenanceoutage === 'Y',
        estimatedReturnAt: nyLocalToIso(row.estimatedreturntoservice),
        lastSeenAt: now,
      }),
    )
  }

  const open: string[] = await client.fetch('*[_type == "outage" && status in ["active", "upcoming"]]._id')
  const gone = open.filter((id) => !seen.has(id))
  for (const id of gone) tx.patch(id, (p) => p.set({status: 'resolved', resolvedAt: now}))
  // Freshness comes from this run record, not from the newest outage, so it stays true even when
  // no outage changed. Same transaction: the record can never claim a run that did not commit.
  // No dot in the _id: dotted ids are private and anonymous public reads could not see it.
  tx.createOrReplace({
    _id: 'ingestrun-outages',
    _type: 'ingestRun',
    feed: 'outages',
    finishedAt: now,
    rows: feed.length,
    upserted: seen.size,
    resolved: gone.length,
    unknownEquipment: skipped,
  })

  await tx.commit({visibility: 'async'})
  console.log(`feed ${feed.length}, upserted ${seen.size}, resolved ${gone.length}, unknown equipment ${skipped}`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
