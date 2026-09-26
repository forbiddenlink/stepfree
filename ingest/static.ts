// One-time (re-runnable) load: lines, station complexes, equipment + reliability history.
import {cleanComplexName} from './feed'
import {FEEDS, NON_SUBWAY, commitInChunks, complexId, equipmentId, getJson, lineId, ref, sanity} from './lib'

type EquipmentRow = {
  station: string
  trainno: string
  equipmentno: string
  equipmenttype: 'EL' | 'ES'
  serving: string
  ADA: string
  isactive: string
  nonNYCT: string
  shortdescription: string
  linesservedbyelevator: string
  elevatorsgtfsstopid: string
  stationcomplexid: string
  nextadanorth: string
  nextadasouth: string
  redundant: number | string
  busconnections: string
  alternativeroute: string
}
type StationRow = {
  gtfs_stop_id: string
  complex_id: string
  stop_name: string
  borough: string
  daytime_routes: string
  gtfs_latitude: string
  gtfs_longitude: string
  ada: string
}
type MonthRow = {
  equipment_code: string
  month: string
  _24_hour_availability?: string
  am_peak_availability?: string
  pm_peak_availability?: string
  total_outages?: string
  unscheduled_outages?: string
  entrapments?: string
  time_since_major_improvement?: string
  station_complex_name?: string
}

const BOROUGH: Record<string, string> = {M: 'Manhattan', Bk: 'Brooklyn', Q: 'Queens', Bx: 'Bronx', SI: 'Staten Island'}
const num = (v: string | undefined): number | undefined => (v == null || v === '' ? undefined : Number(v))
const splitLines = (v: string): string[] =>
  v.split(/[\/\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)

// "148, A, C / 389, B, D" -> [{mrn:'148', lines:['A','C']}, {mrn:'389', lines:['B','D']}]
function parseNextAda(v: string): Array<{mrn: string; lines: string[]}> {
  return v
    .split('/')
    .map((group) => group.split(',').map((s) => s.trim()).filter(Boolean))
    .filter((parts) => parts.length > 0 && /^\d+$/.test(parts[0]))
    .map(([mrn, ...lines]) => ({mrn, lines: lines.map((l) => l.toUpperCase())}))
}

async function main(): Promise<void> {
  const client = sanity()
  const [equipment, stations] = await Promise.all([
    getJson<EquipmentRow[]>(FEEDS.equipment),
    getJson<StationRow[]>(`${FEEDS.stations}?$limit=5000`),
  ])
  if (equipment.length < 500 || stations.length < 400) {
    throw new Error(`Suspiciously small feeds: ${equipment.length} equipment, ${stations.length} stations`)
  }

  // Availability: newest 24 months per unit + all-time entrapments.
  const latest = await getJson<Array<{max_month: string}>>(`${FEEDS.availability}?$select=max(month)`)
  const maxMonth = new Date(latest[0].max_month)
  const from = new Date(Date.UTC(maxMonth.getUTCFullYear() - 2, maxMonth.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
  const recent = await getJson<MonthRow[]>(
    `${FEEDS.availability}?$where=month>='${from}'&$limit=50000&$order=month`,
  )
  const allTime = await getJson<Array<{equipment_code: string; e: string; n: string}>>(
    `${FEEDS.availability}?$select=equipment_code,sum(entrapments) as e,count(*) as n&$group=equipment_code&$limit=5000`,
  )
  const allTimeBy = new Map(allTime.map((r) => [r.equipment_code, r]))
  const historyBy = new Map<string, MonthRow[]>()
  const complexNameByMrn = new Map<string, string>()
  for (const r of recent) {
    historyBy.set(r.equipment_code, [...(historyBy.get(r.equipment_code) ?? []), r])
  }

  // Lines
  const lineCodes = new Set<string>()
  for (const e of equipment) splitLines(e.linesservedbyelevator || e.trainno).forEach((l) => lineCodes.add(l))
  for (const s of stations) splitLines(s.daytime_routes).forEach((l) => lineCodes.add(l))
  const lineDocs = [...lineCodes].sort().map((code) => ({
    _id: lineId(code),
    _type: 'line',
    code,
    isSubway: !NON_SUBWAY.has(code),
  }))

  // Station complexes (every complex, accessible or not, so the agent can say "not accessible").
  const byComplex = new Map<string, StationRow[]>()
  for (const s of stations) byComplex.set(s.complex_id, [...(byComplex.get(s.complex_id) ?? []), s])
  for (const r of recent) {
    const mrn = String((r as MonthRow & {station_complex_mrn?: string}).station_complex_mrn ?? '')
    if (mrn && r.station_complex_name) complexNameByMrn.set(mrn, r.station_complex_name)
  }

  // nextadanorth/south name a STATION id, not a complex id (they differ inside multi-station
  // complexes, e.g. 8 Av L = station 117 in complex 618). Translate before linking.
  const stationToComplex = new Map(stations.map((s) => [(s as StationRow & {station_id: string}).station_id, s.complex_id]))
  const neighbors = new Map<string, Map<string, {direction: string; mrn: string; lines: string[]}>>()
  for (const e of equipment) {
    for (const [direction, raw] of [['north', e.nextadanorth], ['south', e.nextadasouth]] as const) {
      for (const hop of parseNextAda(raw ?? '')) {
        const n = {...hop, mrn: stationToComplex.get(hop.mrn) ?? hop.mrn}
        if (n.mrn === e.stationcomplexid) continue
        const key = `${direction}-${n.mrn}-${n.lines.join('')}`
        const m = neighbors.get(e.stationcomplexid) ?? new Map()
        m.set(key, {direction, ...n})
        neighbors.set(e.stationcomplexid, m)
      }
    }
  }

  const knownComplexes = new Set([...byComplex.keys()])
  const complexDocs = [...byComplex.entries()].map(([mrn, rows]) => {
    const adaValues = rows.map((r) => r.ada)
    const adaStatus = adaValues.every((a) => a === '1') ? 'full' : adaValues.some((a) => a === '1' || a === '2') ? 'partial' : 'none'
    const lines = [...new Set(rows.flatMap((r) => splitLines(r.daytime_routes)))]
    const names = [...new Set(rows.map((r) => r.stop_name))]
    return {
      _id: complexId(mrn),
      _type: 'stationComplex',
      name: cleanComplexName(complexNameByMrn.get(mrn) ?? names.join(' / ')),
      stopNames: names.sort(),
      complexId: mrn,
      borough: BOROUGH[rows[0].borough] ?? rows[0].borough,
      location: {_type: 'geopoint', lat: Number(rows[0].gtfs_latitude), lng: Number(rows[0].gtfs_longitude)},
      lines: lines.map((l) => ref(lineId(l), l)),
      adaStatus,
      gtfsStopIds: rows.map((r) => r.gtfs_stop_id),
    }
  })
  // Complexes that only appear in the equipment feed (e.g. non-NYCT connections): stub them.
  for (const e of equipment) {
    if (!knownComplexes.has(e.stationcomplexid)) {
      knownComplexes.add(e.stationcomplexid)
      complexDocs.push({
        _id: complexId(e.stationcomplexid),
        _type: 'stationComplex',
        name: e.station,
        complexId: e.stationcomplexid,
        lines: splitLines(e.trainno).map((l) => ref(lineId(l), l)),
      } as (typeof complexDocs)[number])
    }
  }
  for (const doc of complexDocs) {
    const edges = [...(neighbors.get(doc.complexId)?.values() ?? [])].filter((n) => knownComplexes.has(n.mrn))
    const bus = new Set(
      equipment
        .filter((e) => e.stationcomplexid === doc.complexId)
        .flatMap((e) => (e.busconnections ?? '').split(',').map((s) => s.trim()).filter(Boolean)),
    )
    Object.assign(doc, {
      adaNeighbors: edges.map((n, i) => ({
        _key: `${n.direction}-${n.mrn}-${i}`,
        _type: 'adaNeighbor',
        direction: n.direction,
        complex: {...ref(complexId(n.mrn)), _weak: true},
        lines: n.lines.map((l) => ref(lineId(l), l)),
      })),
      busConnections: [...bus],
    })
  }

  // Equipment
  const avg = (xs: Array<number | undefined>): number | undefined => {
    const v = xs.filter((x): x is number => typeof x === 'number' && !Number.isNaN(x))
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10000) / 10000 : undefined
  }
  const sum = (xs: Array<number | undefined>): number => xs.reduce<number>((a, b) => a + (b ?? 0), 0)
  const equipmentDocs = equipment.map((e) => {
    const hist = (historyBy.get(e.equipmentno) ?? []).sort((a, b) => a.month.localeCompare(b.month))
    const last12 = hist.slice(-12)
    const at = allTimeBy.get(e.equipmentno)
    return {
      _id: equipmentId(e.equipmentno),
      _type: 'equipment',
      equipmentNo: e.equipmentno,
      kind: e.equipmenttype === 'EL' ? 'elevator' : 'escalator',
      complex: ref(complexId(e.stationcomplexid)),
      lines: splitLines(e.linesservedbyelevator || e.trainno).map((l) => ref(lineId(l), l)),
      serving: e.serving,
      shortDescription: e.shortdescription,
      isAda: e.ADA === 'Y',
      isActive: e.isactive === 'Y',
      isRedundant: Number(e.redundant) === 1,
      operatedByNyct: e.nonNYCT === 'N',
      alternativeRoute: e.alternativeroute || undefined,
      reliability: {
        monthsTracked: at ? Number(at.n) : 0,
        availability12mo: avg(last12.map((m) => num(m._24_hour_availability))),
        amPeakAvailability12mo: avg(last12.map((m) => num(m.am_peak_availability))),
        unscheduledOutages12mo: sum(last12.map((m) => num(m.unscheduled_outages))),
        entrapments12mo: sum(last12.map((m) => num(m.entrapments))),
        entrapmentsAllTime: at ? Number(at.e) : 0,
        monthsSinceMajorImprovement: num(hist.at(-1)?.time_since_major_improvement),
      },
      history: hist.map((m) => ({
        _key: m.month.slice(0, 7),
        _type: 'availabilityMonth',
        month: m.month.slice(0, 10),
        availability24h: num(m._24_hour_availability),
        amPeakAvailability: num(m.am_peak_availability),
        pmPeakAvailability: num(m.pm_peak_availability),
        totalOutages: num(m.total_outages),
        unscheduledOutages: num(m.unscheduled_outages),
        entrapments: num(m.entrapments),
      })),
    }
  })

  console.log(`lines ${lineDocs.length}, complexes ${complexDocs.length}, equipment ${equipmentDocs.length}, history rows ${recent.length}`)
  await commitInChunks(client, lineDocs)
  await commitInChunks(client, complexDocs)
  await commitInChunks(client, equipmentDocs, 50)
  console.log('static ingest done')
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
