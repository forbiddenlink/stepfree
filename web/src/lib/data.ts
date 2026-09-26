import {createClient} from '@sanity/client'
import type {Complex, EquipmentInfo, Outage} from './graph'

// Public dataset: anonymous reads. Bypass the CDN for current outage status.
export const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '19mt1buh',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2026-09-01',
  useCdn: false,
  perspective: 'published',
})

const GRAPH_QUERY = `*[_type == "stationComplex"]{
  complexId, name, adaStatus, borough,
  "lines": lines[]->code,
  "edges": coalesce(adaNeighbors[defined(complex->complexId)]{
    direction, "to": complex->complexId, "lines": lines[]->code
  }, [])
}`

// Only accessible elevators matter for step-free travel.
const OUTAGE_QUERY = `*[_type == "outage" && status in ["active", "upcoming"]
  && equipment->isAda && equipment->kind == "elevator"]{
  status, startsAt, estimatedReturnAt, reason,
  "equipmentNo": equipment->equipmentNo,
  "isRedundant": equipment->isRedundant,
  "alternativeRoute": equipment->alternativeRoute,
  "complexId": equipment->complex->complexId
}`

const EQUIPMENT_QUERY = `*[_type == "equipment" && kind == "elevator" && isAda == true]{
  equipmentNo, serving, shortDescription, isRedundant,
  "complexId": complex->complexId,
  "lines": lines[]->code,
  "availability12mo": reliability.availability12mo,
  alternativeRoute
}`

/** data.ny.gov names ~120 complexes "72 St - Station"; riders never say that, and it hides same-name stops from matching. */
export const cleanStationName = (name: string): string => name.replace(/\s*-\s*Station$/i, '').trim() || name

export async function loadNetwork(): Promise<{
  complexes: Complex[]
  outages: Outage[]
  equipment: EquipmentInfo[]
  fetchedAt: string
  sourceUpdatedAt: string
}> {
  const [complexes, outages, equipment, sourceUpdatedAt] = await Promise.all([
    sanity.fetch<Complex[]>(GRAPH_QUERY),
    sanity.fetch<Outage[]>(OUTAGE_QUERY),
    // No catch: without elevator data every route would look impossible, which is a failure, not an answer.
    sanity.fetch<EquipmentInfo[]>(EQUIPMENT_QUERY),
    // Last successful ingest run; falls back to the newest outage sighting for runs before the record existed.
    sanity.fetch<string | null>(
      'coalesce(*[_id == "ingestrun-outages"][0].finishedAt, *[_type == "outage" && defined(lastSeenAt)] | order(lastSeenAt desc)[0].lastSeenAt)',
    ),
  ])
  const age = sourceUpdatedAt ? Date.now() - Date.parse(sourceUpdatedAt) : NaN
  if (!Number.isFinite(age) || age > 60 * 60_000 || age < -5 * 60_000) {
    throw new Error('Current outage data is unavailable or more than an hour old. Check mta.info/elevators before planning a trip.')
  }
  return {complexes: complexes.map((c) => ({...c, name: cleanStationName(c.name)})), outages, equipment: equipment ?? [], fetchedAt: new Date().toISOString(), sourceUpdatedAt: sourceUpdatedAt!}
}

/** Loose station-name match: "72 st", "72nd", "times sq", "72 st q" -> candidate complexes, best first. */
export function matchStation(complexes: Complex[], query: string): Complex[] {
  const norm = (s: string): string =>
    s
      .toLowerCase()
      .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
      .replace(/\bcenter\b/g, 'ctr')
      .replace(/\bbroadway\b/g, 'bway')
      .replace(/\bterminal\b/g, 'term')
      .replace(/\bturnpike\b/g, 'tpke')
      .replace(/\bparkway\b/g, 'pkwy')
      .replace(/\bjunction\b/g, 'jct')
      .replace(/\bheights\b/g, 'hts')
      .replace(/\bstreet\b/g, 'st')
      .replace(/\bavenue\b/g, 'av')
      .replace(/\bsquare\b/g, 'sq')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  const q = norm(query)
  if (!q) return []
  const exact = complexes.filter((c) => norm(c.name) === q)
  if (exact.length === 1) return exact

  const tokens = q.split(' ').filter(Boolean)
  const scored = complexes
    .map((c) => {
      const n = norm(c.name)
      const nameTokens = n.split(' ')
      const lines = (c.lines ?? []).map((l) => l.toLowerCase())
      const boro = (c.borough ?? '').toLowerCase()

      if (n === q) return {c, score: 100}

      const lineMatches = tokens.filter((t) => lines.includes(t)).length
      const allTokensMatch = tokens.every(
        (t) => nameTokens.includes(t) || lines.includes(t) || boro.includes(t),
      )

      let score = 0
      if (allTokensMatch && nameTokens.some((t) => tokens.includes(t))) {
        score = 80 + lineMatches * 15 + (c.adaStatus === 'full' ? 5 : 0)
      } else if (n.startsWith(q)) {
        score = 50 + (c.adaStatus === 'full' ? 5 : 0)
      } else if (tokens.every((t) => nameTokens.includes(t))) {
        score = 20 + (c.adaStatus === 'full' ? 5 : 0)
      } else if (tokens.filter((t) => nameTokens.includes(t)).length >= 2) {
        score = 10 + tokens.filter((t) => nameTokens.includes(t)).length
      }
      return {c, score}
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return []
  const maxScore = scored[0].score
  return scored
    .filter((x) => (maxScore >= 80 ? x.score >= maxScore - 10 : x.score > 0))
    .map((x) => x.c)
}

export type StationResolution =
  | {kind: 'match'; complex: Complex}
  | {kind: 'ambiguous'; candidates: Complex[]}
  | {kind: 'none'}

/**
 * Resolve a rider's station reference without guessing. A known complexId (from an earlier
 * clarification) wins; a single name match is used; anything else goes back to the rider.
 * Never pick the "best" of several matches: an accessible look-alike is a different trip.
 */
export function resolveStation(complexes: Complex[], query: string, complexId?: string): StationResolution {
  const byId = complexId ? complexes.find((c) => c.complexId === complexId) : undefined
  if (byId) return {kind: 'match', complex: byId}
  const matches = matchStation(complexes, query)
  if (matches.length === 0) return {kind: 'none'}
  if (matches.length === 1) return {kind: 'match', complex: matches[0]}
  return {kind: 'ambiguous', candidates: matches.slice(0, 6)}
}
