// Emails riders whose confirmed commute watch now crosses a broken accessible elevator.
// Runs right after ingest/outages.ts on the same 15-minute schedule.
//
// Idempotent by design: each watch records the outage ids it has already been told about, and
// the Resend idempotency key covers the gap if a send succeeds but the patch after it fails.
// Pass --dry-run to print what would be sent without sending or writing.
import {sanity} from './lib'
import {alertEmail, sendEmail, sha256, watchesClient, watchLink, type AlertOutage, type Watch} from '../web/src/lib/watch'

const MAX_EMAILS_PER_RUN = 50 // a feed glitch that "breaks" every elevator must not become a mass mailing

// Active outages, plus planned ones starting within a day, on non-redundant accessible elevators.
const OUTAGES = `*[_type == "outage" && equipment->isAda && equipment->kind == "elevator" && !equipment->isRedundant
  && (status == "active" || (status == "upcoming" && dateTime(startsAt) < dateTime(now()) + 60*60*24))]{
  _id, status, startsAt, estimatedReturnAt, reason,
  "equipmentNo": equipment->equipmentNo,
  "alternativeRoute": equipment->alternativeRoute,
  "complexId": equipment->complex->complexId,
  "stationName": equipment->complex->name
}`

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const outages = await sanity().fetch<AlertOutage[]>(OUTAGES)
  const openIds = new Set<string>(await sanity().fetch('*[_type == "outage" && status in ["active", "upcoming"]]._id'))
  const watches = watchesClient()
  const active = await watches.fetch<Watch[]>('*[_type == "watch" && status == "active"]')

  let sent = 0
  for (const w of active) {
    const told = new Set(w.notified ?? [])
    const hits = outages.filter((o) => w.keyComplexes.includes(o.complexId) && !told.has(o._id))
    if (!hits.length) continue
    if (sent >= MAX_EMAILS_PER_RUN) {
      console.warn(`email cap ${MAX_EMAILS_PER_RUN} reached; remaining watches wait for the next run`)
      break
    }
    const ids = hits.map((o) => o._id).sort()
    console.log(`${w._id}: ${ids.length} new outage(s) ${dryRun ? '(dry run)' : ''}`)
    if (dryRun) continue
    await sendEmail(w.email, alertEmail(w, hits), `alert-${w._id}-${sha256(ids.join(',')).slice(0, 16)}`, watchLink('stop', w.stopToken))
    // Drop ids for outages that have closed so the list stays small; keep the new ones.
    const notified = [...[...told].filter((id) => openIds.has(id)), ...ids]
    await watches.patch(w._id).set({notified}).commit()
    sent++
  }
  console.log(`watches ${active.length}, open alertable outages ${outages.length}, emails ${dryRun ? 'skipped (dry run)' : sent}`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
