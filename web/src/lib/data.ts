import {createClient} from '@sanity/client'
import type {Complex, Outage} from './graph'

// Public dataset: anonymous, CDN-cached reads. No token ever reaches this module.
export const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '19mt1buh',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2026-09-01',
  useCdn: true,
  perspective: 'published',
})

const GRAPH_QUERY = `*[_type == "stationComplex"]{
  complexId, name, adaStatus,
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

export async function loadNetwork(): Promise<{complexes: Complex[]; outages: Outage[]; fetchedAt: string}> {
  const [complexes, outages] = await Promise.all([
    sanity.fetch<Complex[]>(GRAPH_QUERY),
    sanity.fetch<Outage[]>(OUTAGE_QUERY),
  ])
  return {complexes, outages, fetchedAt: new Date().toISOString()}
}

/** Loose station-name match: "72 st", "72nd", "times sq" -> candidate complexes, best first. */
export function matchStation(complexes: Complex[], query: string): Complex[] {
  const norm = (s: string): string =>
    s.toLowerCase().replace(/(\d+)(st|nd|rd|th)\b/g, '$1').replace(/street/g, 'st').replace(/avenue/g, 'av').replace(/square/g, 'sq').replace(/[^a-z0-9]+/g, ' ').trim()
  const q = norm(query)
  const tokens = q.split(' ').filter(Boolean)
  return complexes
    .map((c) => {
      const n = norm(c.name)
      const score = n === q ? 100 : n.startsWith(q) ? 50 : tokens.every((t) => n.split(' ').includes(t)) ? 20 + (c.adaStatus === 'full' ? 5 : 0) : 0
      return {c, score}
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c)
}
