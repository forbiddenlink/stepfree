// One-off, patch-only backfill: clean complex names and add the station names riders use
// ("Atlantic Av-Barclays Ctr" lives on a stop, not on its complex "Atlantic Av/Pacific St").
// Touches only `name` and `stopNames`; nothing else on the complex changes. Idempotent.
//   pnpm backfill:names --dry-run    report what would change
//   pnpm backfill:names              apply
import {FEEDS, getJson, sanity} from './lib'
import {cleanComplexName} from './feed'

type StationRow = {complex_id: string; stop_name: string}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const client = sanity()
  const stations = await getJson<StationRow[]>(`${FEEDS.stations}?$limit=5000`)
  const stops = new Map<string, Set<string>>()
  for (const s of stations) stops.set(s.complex_id, (stops.get(s.complex_id) ?? new Set()).add(s.stop_name.trim()))

  const complexes = await client.fetch<Array<{_id: string; complexId: string; name: string; stopNames?: string[]}>>(
    '*[_type == "stationComplex"]{_id, complexId, name, stopNames}',
  )
  const patches = complexes.flatMap((c) => {
    const name = cleanComplexName(c.name)
    const stopNames = [...(stops.get(c.complexId) ?? [])].sort()
    const set: Record<string, unknown> = {}
    if (name !== c.name) set.name = name
    if (stopNames.length && JSON.stringify(stopNames) !== JSON.stringify(c.stopNames ?? [])) set.stopNames = stopNames
    return Object.keys(set).length ? [{id: c._id, before: c.name, set}] : []
  })
  const renamed = patches.filter((p) => 'name' in p.set).length
  console.log(`${complexes.length} complexes, ${patches.length} to patch (${renamed} renamed)`)
  for (const p of patches.slice(0, 5)) console.log(' ', p.before, '->', JSON.stringify(p.set))
  if (dryRun) return

  for (let i = 0; i < patches.length; i += 100) {
    const tx = client.transaction()
    for (const p of patches.slice(i, i + 100)) tx.patch(p.id, (patch) => patch.set(p.set))
    await tx.commit({visibility: 'async'})
  }
  console.log('applied')
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
