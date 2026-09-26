// Step-free routing over the MTA "next accessible station" graph.
//
// Riding THROUGH a station never needs its elevators, so an outage only matters where the
// rider boards, alights, or transfers. The search runs over (complex, line) states:
// riding one hop costs 1, changing lines inside a complex costs TRANSFER_COST and is only
// allowed where that complex's accessible elevators are expected to be working.

export type Edge = {direction: 'north' | 'south'; to: string; lines: string[]}
export type Complex = {
  complexId: string
  name: string
  adaStatus?: 'full' | 'partial' | 'none'
  borough?: string
  lines?: string[]
  edges: Edge[]
}
export type Outage = {
  complexId: string
  equipmentNo: string
  status: 'active' | 'upcoming' | 'resolved'
  startsAt?: string
  estimatedReturnAt?: string
  reason?: string
  isRedundant?: boolean
  alternativeRoute?: string
}

export type EquipmentInfo = {
  equipmentNo: string
  serving?: string
  shortDescription?: string
  isRedundant?: boolean
  complexId: string
  lines?: string[]
  availability12mo?: number
  alternativeRoute?: string
}

export type EquipmentState = {
  equipmentNo: string
  serving?: string
  shortDescription?: string
  isRedundant?: boolean
  lines?: string[]
  availability12mo?: number
  isOut: boolean
  outageReason?: string
  estimatedReturnAt?: string
  alternativeRoute?: string
}

export type StationEquipment = {
  complexId: string
  stationName: string
  role: 'origin' | 'transfer' | 'destination'
  elevators: EquipmentState[]
  hasOutage: boolean
}

export type Leg = {line: string; from: string; to: string; accessibleHops: number} // hops between ACCESSIBLE stations, not every stop
export type RouteResult =
  | {
      ok: true
      legs: Leg[]
      transfers: string[]
      warnings: string[]
      complexesUsed: string[]
      keyComplexes: string[]
      equipmentOnRoute?: StationEquipment[]
    }
  | {
      ok: false
      reason: string
      warnings: string[]
      equipmentOnRoute?: StationEquipment[]
    }

export const TRANSFER_COST = 3

/** An elevator counts as out at `at` if active now, or scheduled to be out at that time. */
export function isOutAt(o: Outage, at: Date): boolean {
  if (o.status === 'resolved') return false
  const start = o.startsAt ? Date.parse(o.startsAt) : -Infinity
  const end = o.estimatedReturnAt ? Date.parse(o.estimatedReturnAt) : Infinity
  const t = at.getTime()
  // An estimated return is not evidence of repair; only ingestion can resolve an outage.
  if (o.status === 'active') return true
  return t >= start && t < end
}

/** Complexes where at least one non-redundant accessible elevator is out at `at`. */
export function degradedComplexes(outages: Outage[], at: Date): Map<string, Outage[]> {
  const out = new Map<string, Outage[]>()
  for (const o of outages) {
    if (o.isRedundant || !isOutAt(o, at)) continue
    out.set(o.complexId, [...(out.get(o.complexId) ?? []), o])
  }
  return out
}

export function buildEquipmentOnRoute(
  keyComplexes: string[],
  fromId: string,
  toId: string,
  byId: Map<string, Complex>,
  equipment: EquipmentInfo[] | undefined,
  outages: Outage[],
  at: Date,
): StationEquipment[] {
  if (!equipment || equipment.length === 0) return []
  const eqByComplex = new Map<string, EquipmentInfo[]>()
  for (const eq of equipment) {
    const list = eqByComplex.get(eq.complexId) ?? []
    list.push(eq)
    eqByComplex.set(eq.complexId, list)
  }
  const outageByNo = new Map<string, Outage>()
  for (const o of outages) {
    if (isOutAt(o, at)) outageByNo.set(o.equipmentNo, o)
  }

  const result: StationEquipment[] = []
  const seen = new Set<string>()

  for (const cid of keyComplexes) {
    if (seen.has(cid)) continue
    seen.add(cid)
    const c = byId.get(cid)
    const eqList = eqByComplex.get(cid) ?? []
    const role: 'origin' | 'transfer' | 'destination' =
      cid === fromId ? 'origin' : cid === toId ? 'destination' : 'transfer'
    const elevators: EquipmentState[] = eqList.map((eq) => {
      const out = outageByNo.get(eq.equipmentNo)
      return {
        equipmentNo: eq.equipmentNo,
        serving: eq.serving,
        shortDescription: eq.shortDescription,
        isRedundant: eq.isRedundant,
        lines: eq.lines,
        availability12mo: eq.availability12mo,
        isOut: Boolean(out),
        outageReason: out?.reason,
        estimatedReturnAt: out?.estimatedReturnAt,
        alternativeRoute: out?.alternativeRoute ?? eq.alternativeRoute,
      }
    })
    result.push({
      complexId: cid,
      stationName: c?.name ?? cid,
      role,
      elevators,
      hasOutage: elevators.some((e) => e.isOut),
    })
  }
  return result
}

type State = {complex: string; line: string}
const key = (s: State): string => `${s.complex}|${s.line}`

/** Undirected adjacency: MTA lists "next accessible north/south"; riders can ride either way. */
function adjacency(complexes: Complex[]): Map<string, Array<{to: string; line: string}>> {
  const adj = new Map<string, Array<{to: string; line: string}>>()
  const add = (a: string, b: string, line: string): void => {
    const list = adj.get(a) ?? []
    if (!list.some((e) => e.to === b && e.line === line)) list.push({to: b, line})
    adj.set(a, list)
  }
  for (const c of complexes) {
    for (const e of c.edges) {
      for (const line of e.lines) {
        add(c.complexId, e.to, line)
        add(e.to, c.complexId, line)
      }
    }
  }
  return adj
}

export function findStepFreeRoute(
  complexes: Complex[],
  outages: Outage[],
  fromId: string,
  toId: string,
  at: Date,
  equipment?: EquipmentInfo[],
): RouteResult {
  if (!Number.isFinite(at.getTime())) return {ok: false, reason: 'Invalid departure time.', warnings: []}
  const byId = new Map(complexes.map((c) => [c.complexId, c]))
  const from = byId.get(fromId)
  const to = byId.get(toId)
  if (!from || !to) return {ok: false, reason: 'Unknown station.', warnings: []}

  const warnings: string[] = []
  for (const c of [from, to]) {
    if (c.adaStatus === 'none') {
      return {ok: false, reason: `${c.name} has no accessible entrance.`, warnings}
    }
    if (c.adaStatus !== 'full') {
      return {ok: false, reason: `Step-free platform access at ${c.name} is not confirmed by this network. Check the MTA station details.`, warnings}
    }
  }
  const degraded = degradedComplexes(outages, at)
  for (const c of [from, to]) {
    const outs = degraded.get(c.complexId)
    if (outs) {
      warnings.push(
        `${c.name}: elevator ${outs.map((o) => o.equipmentNo).join(', ')} expected out of service (${outs[0].reason ?? 'no reason given'}).` +
          (outs[0].alternativeRoute ? ` MTA detour: ${outs[0].alternativeRoute}` : ''),
      )
    }
  }
  if (degraded.has(fromId) || degraded.has(toId)) {
    const equipmentOnRoute = buildEquipmentOnRoute([fromId, toId], fromId, toId, byId, equipment, outages, at)
    return {
      ok: false,
      reason: 'An elevator outage affects boarding or leaving this route. Step-free access cannot be confirmed.',
      warnings,
      equipmentOnRoute,
    }
  }
  if (fromId === toId) {
    const equipmentOnRoute = buildEquipmentOnRoute([fromId], fromId, toId, byId, equipment, outages, at)
    return {ok: true, legs: [], transfers: [], warnings, complexesUsed: [fromId], keyComplexes: [fromId], equipmentOnRoute}
  }

  const adj = adjacency(complexes)
  // Dijkstra over (complex, line). Small graph (~340 edges): a sorted array is plenty.
  const dist = new Map<string, number>()
  const prev = new Map<string, State>()
  const queue: Array<{s: State; d: number}> = []
  for (const e of adj.get(fromId) ?? []) {
    const s = {complex: fromId, line: e.line}
    if (!dist.has(key(s))) {
      dist.set(key(s), 0)
      queue.push({s, d: 0})
    }
  }
  let goal: State | undefined
  while (queue.length) {
    queue.sort((a, b) => a.d - b.d)
    const {s, d} = queue.shift()!
    if (d > (dist.get(key(s)) ?? Infinity)) continue
    if (s.complex === toId) {
      goal = s
      break
    }
    const relax = (n: State, cost: number): void => {
      const nd = d + cost
      if (nd < (dist.get(key(n)) ?? Infinity)) {
        dist.set(key(n), nd)
        prev.set(key(n), s)
        queue.push({s: n, d: nd})
      }
    }
    for (const e of adj.get(s.complex) ?? []) {
      if (e.line === s.line) relax({complex: e.to, line: e.line}, 1)
      else if (s.complex !== fromId && byId.get(s.complex)?.adaStatus === 'full' && !degraded.has(s.complex)) relax({complex: s.complex, line: e.line}, TRANSFER_COST)
    }
  }
  if (!goal) {
    const equipmentOnRoute = buildEquipmentOnRoute([fromId, toId], fromId, toId, byId, equipment, outages, at)
    return {
      ok: false,
      reason: 'No step-free route found in the MTA accessible-station graph with the elevators expected to be working.',
      warnings,
      equipmentOnRoute,
    }
  }

  const path: State[] = []
  for (let cur: State | undefined = goal; cur; cur = prev.get(key(cur))) path.unshift(cur)
  const legs: Leg[] = []
  const transfers: string[] = []
  // Where the rider actually uses elevators: board, each transfer, alight. Watches alert on these.
  const keyComplexes = [fromId]
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    if (a.complex === b.complex) {
      transfers.push(byId.get(a.complex)?.name ?? a.complex)
      keyComplexes.push(a.complex)
      continue
    }
    const last = legs.at(-1)
    if (last && last.line === b.line && last.to === (byId.get(a.complex)?.name ?? a.complex)) {
      last.to = byId.get(b.complex)?.name ?? b.complex
      last.accessibleHops++
    } else {
      legs.push({line: b.line, from: byId.get(a.complex)?.name ?? a.complex, to: byId.get(b.complex)?.name ?? b.complex, accessibleHops: 1})
    }
  }
  keyComplexes.push(toId)
  const equipmentOnRoute = buildEquipmentOnRoute(keyComplexes, fromId, toId, byId, equipment, outages, at)
  return {ok: true, legs, transfers, warnings, complexesUsed: [...new Set(path.map((p) => p.complex))], keyComplexes, equipmentOnRoute}
}
