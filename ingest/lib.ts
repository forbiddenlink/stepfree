import {createClient, type SanityClient} from '@sanity/client'

export const FEEDS = {
  equipment: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene_equipments.json',
  outages: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene.json',
  stations: 'https://data.ny.gov/resource/39hk-dx4f.json',
  availability: 'https://data.ny.gov/resource/rc78-7x78.json',
} as const

export function sanity(): SanityClient {
  // Project ID is public (the dataset is public); only the token is secret.
  const projectId = process.env.SANITY_PROJECT_ID ?? '19mt1buh'
  const token = process.env.SANITY_WRITE_TOKEN
  if (!token) throw new Error('SANITY_WRITE_TOKEN must be set (in .env.local)')
  return createClient({
    projectId,
    dataset: process.env.SANITY_DATASET ?? 'production',
    token,
    apiVersion: '2026-09-01',
    useCdn: false,
  })
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {headers: {accept: 'application/json'}})
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return (await res.json()) as T
}

export const lineId = (code: string): string => `line-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
export const complexId = (mrn: string): string => `complex-${mrn}`
export const equipmentId = (no: string): string => `equipment-${no}`
export const ref = (id: string, key?: string) => ({_type: 'reference' as const, _ref: id, ...(key ? {_key: key} : {})})

export const NON_SUBWAY = new Set(['LIRR', 'METRO-NORTH', 'SIR'])

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

export async function commitInChunks(
  client: SanityClient,
  docs: Array<Record<string, unknown> & {_id: string; _type: string}>,
  size = 100,
): Promise<void> {
  for (let i = 0; i < docs.length; i += size) {
    const tx = client.transaction()
    for (const doc of docs.slice(i, i + size)) tx.createOrReplace(doc)
    await tx.commit({visibility: 'async'})
    process.stdout.write(`  committed ${Math.min(i + size, docs.length)}/${docs.length}\r`)
  }
  process.stdout.write('\n')
}
