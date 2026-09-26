import {describe, expect, it} from 'vitest'
import {findStepFreeRoute, isOutAt, type Complex, type EquipmentInfo, type Outage} from './graph'

// Toy network:  A --1-- B --1-- C      (line 1)
//                       B --L-- D      (line L, transfer at B)
//               A --Q-- E --Q-- D      (line Q, longer but no transfer)
const net: Complex[] = [
  {complexId: 'A', name: 'Alpha', adaStatus: 'full', edges: [{direction: 'north', to: 'B', lines: ['1']}, {direction: 'south', to: 'E', lines: ['Q']}]},
  {complexId: 'B', name: 'Bravo', adaStatus: 'full', edges: [{direction: 'north', to: 'C', lines: ['1']}, {direction: 'south', to: 'D', lines: ['L']}]},
  {complexId: 'C', name: 'Charlie', adaStatus: 'full', edges: []},
  {complexId: 'D', name: 'Delta', adaStatus: 'full', edges: []},
  {complexId: 'E', name: 'Echo', adaStatus: 'full', edges: [{direction: 'north', to: 'D', lines: ['Q']}]},
  {complexId: 'N', name: 'Nope', adaStatus: 'none', edges: []},
]
const now = new Date('2026-09-20T12:00:00Z')

describe('findStepFreeRoute', () => {
  it('rides one line without transferring', () => {
    const r = findStepFreeRoute(net, [], 'A', 'C', now)
    expect(r.ok && r.legs).toEqual([{line: '1', from: 'Alpha', to: 'Charlie', accessibleHops: 2}])
  })

  it('prefers a transfer-free route when the transfer path is not shorter', () => {
    // A-1-B, transfer (3), B-L-D = 5  vs  A-Q-E-Q-D = 2
    const r = findStepFreeRoute(net, [], 'A', 'D', now)
    expect(r.ok && r.legs.map((l) => l.line)).toEqual(['Q'])
  })

  it('never transfers at a station whose elevator is out, but can ride through it', () => {
    const noQ = net.map((c) => (c.complexId === 'A' ? {...c, edges: c.edges.filter((e) => e.lines[0] !== 'Q')} : c))
    const out: Outage[] = [{complexId: 'B', equipmentNo: 'EL1', status: 'active', reason: 'Repair'}]
    expect(findStepFreeRoute(noQ, [], 'A', 'D', now).ok).toBe(true)
    expect(findStepFreeRoute(noQ, out, 'A', 'D', now).ok).toBe(false)
    expect(findStepFreeRoute(noQ, out, 'A', 'C', now).ok).toBe(true)
  })

  it('lists only the stations where the rider uses elevators as key complexes', () => {
    const noQ = net.map((c) => (c.complexId === 'A' ? {...c, edges: c.edges.filter((e) => e.lines[0] !== 'Q')} : c))
    const r = findStepFreeRoute(noQ, [], 'A', 'D', now)
    expect(r.ok && r.keyComplexes).toEqual(['A', 'B', 'D'])
    const through = findStepFreeRoute(net, [], 'A', 'C', now)
    expect(through.ok && through.keyComplexes).toEqual(['A', 'C'])
  })

  it('refuses stations with no accessible entrance', () => {
    const r = findStepFreeRoute(net, [], 'A', 'N', now)
    expect(r.ok).toBe(false)
  })

  it('warns when the destination elevator is out and quotes the MTA detour', () => {
    const out: Outage[] = [{complexId: 'C', equipmentNo: 'EL9', status: 'active', reason: 'Repair', alternativeRoute: 'Take the M15.'}]
    const r = findStepFreeRoute(net, out, 'A', 'C', now)
    expect(r.ok).toBe(false)
    expect(r.warnings.join(' ')).toContain('Take the M15.')
  })

  it('refuses boarding when the origin elevator is out', () => {
    const out: Outage[] = [{complexId: 'A', equipmentNo: 'EL1', status: 'active'}]
    expect(findStepFreeRoute(net, out, 'A', 'C', now).ok).toBe(false)
  })

  it('rejects an invalid departure time', () => {
    expect(findStepFreeRoute(net, [], 'A', 'C', new Date('invalid')).ok).toBe(false)
  })

  it('does not assume partially accessible or unknown platforms can be used', () => {
    for (const adaStatus of ['partial', undefined] as const) {
      const uncertain = net.map((c) => c.complexId === 'C' ? {...c, adaStatus} : c)
      expect(findStepFreeRoute(uncertain, [], 'A', 'C', now).ok).toBe(false)
    }
  })

  it('does not transfer at a partially accessible complex', () => {
    const network = net.map((c) => c.complexId === 'A'
      ? {...c, edges: c.edges.filter((e) => e.lines[0] !== 'Q')}
      : c.complexId === 'B' ? {...c, adaStatus: 'partial' as const} : c)
    expect(findStepFreeRoute(network, [], 'A', 'D', now).ok).toBe(false)
    expect(findStepFreeRoute(network, [], 'A', 'C', now).ok).toBe(true)
  })

  it('attaches equipment on route for origin, transfer, and destination', () => {
    const eq: EquipmentInfo[] = [
      {equipmentNo: 'EL101', complexId: 'A', serving: 'Street to mezzanine', availability12mo: 0.98},
      {equipmentNo: 'EL102', complexId: 'C', serving: 'Mezzanine to platform', availability12mo: 0.99},
    ]
    const r = findStepFreeRoute(net, [], 'A', 'C', now, eq)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.equipmentOnRoute).toHaveLength(2)
      expect(r.equipmentOnRoute?.[0].stationName).toBe('Alpha')
      expect(r.equipmentOnRoute?.[0].elevators[0].equipmentNo).toBe('EL101')
      expect(r.equipmentOnRoute?.[0].elevators[0].isOut).toBe(false)
      expect(r.equipmentOnRoute?.[0].elevators[0].availability12mo).toBe(0.98)
    }
  })
})

describe('isOutAt', () => {
  const planned: Outage = {complexId: 'B', equipmentNo: 'EL2', status: 'upcoming', startsAt: '2026-09-20T22:00:00Z', estimatedReturnAt: '2026-09-21T06:00:00Z'}
  it('treats a planned outage as out only inside its window', () => {
    expect(isOutAt(planned, now)).toBe(false)
    expect(isOutAt(planned, new Date('2026-09-21T01:00:00Z'))).toBe(true)
    expect(isOutAt(planned, new Date('2026-09-21T07:00:00Z'))).toBe(false)
  })
  it('ignores redundant elevators and resolved outages', () => {
    expect(isOutAt({...planned, status: 'resolved'}, new Date('2026-09-21T01:00:00Z'))).toBe(false)
  })
  it('keeps an active outage blocked after its estimated repair time', () => {
    expect(isOutAt({...planned, status: 'active'}, new Date('2026-09-21T07:00:00Z'))).toBe(true)
  })
})
