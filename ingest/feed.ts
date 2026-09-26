// Pure feed parsing and validation: no Sanity client, so the web app's tests can import it.
export type OutageRow = {
  equipment: string
  outagedate: string
  estimatedreturntoservice: string
  reason: string
  isupcomingoutage: string
  ismaintenanceoutage: string
}

export function validateOutageFeed(feed: unknown, knownEquipment: Set<string>): asserts feed is OutageRow[] {
  if (!Array.isArray(feed) || feed.length === 0) throw new Error('Outage feed empty or malformed; refusing to resolve anything')
  for (const row of feed) {
    if (!row || typeof row !== 'object'
      || typeof row.equipment !== 'string' || !row.equipment.trim()
      || typeof row.outagedate !== 'string' || !nyLocalToIso(row.outagedate)
      || typeof row.estimatedreturntoservice !== 'string'
      || (row.estimatedreturntoservice !== '' && !nyLocalToIso(row.estimatedreturntoservice))
      || typeof row.reason !== 'string'
      || !['Y', 'N'].includes(row.isupcomingoutage)
      || !['Y', 'N'].includes(row.ismaintenanceoutage)) {
      throw new Error('Malformed outage row; refusing to resolve anything')
    }
  }
  if (!feed.some((row) => knownEquipment.has(row.equipment))) {
    throw new Error('No recognized equipment in outage feed; refusing to resolve anything')
  }
}

// MTA feed timestamps are New York local time: "09/28/2026 10:00:00 PM".
export function nyLocalToIso(value: string | undefined): string | undefined {
  if (!value) return undefined
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/)
  if (!m) return undefined
  const [, mo, d, y, hRaw, mi, s, ap] = m
  let h = Number(hRaw) % 12
  if (ap === 'PM') h += 12
  const asUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), h, Number(mi), Number(s))
  // Offset of America/New_York at that instant (handles EST/EDT).
  const tzName = new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', timeZoneName: 'longOffset'})
    .formatToParts(new Date(asUtc))
    .find((p) => p.type === 'timeZoneName')?.value // "GMT-04:00"
  const off = tzName?.match(/GMT([+-])(\d{2}):(\d{2})/)
  const offsetMin = off ? (off[1] === '-' ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3])) : 0
  return new Date(asUtc - offsetMin * 60_000).toISOString()
}
