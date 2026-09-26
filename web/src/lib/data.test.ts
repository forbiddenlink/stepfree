import {afterEach, describe, expect, it, vi} from 'vitest'
import {cleanStationName, loadNetwork, matchStation, resolveStation} from './data'

const {fetchNetwork} = vi.hoisted(() => ({fetchNetwork: vi.fn()}))
vi.mock('@sanity/client', () => ({createClient: () => ({fetch: fetchNetwork})}))
afterEach(() => fetchNetwork.mockReset())

describe('matchStation', () => {
  it('does not match an empty station query to every station', () => {
    expect(matchStation([{complexId: '1', name: '1 Av', edges: []}], '  ')).toEqual([])
  })
  it('prefers an exact station name without including looser matches', () => {
    const exact = {complexId: '1', name: '72 St', edges: []}
    expect(matchStation([exact, {complexId: '2', name: '172 St', edges: []}, {complexId: '3', name: '72 St / Broadway', edges: []}], '72 St')).toEqual([exact])
  })

  it('retains multiple stations with the same name for clarification', () => {
    const stations = [{complexId: '1', name: '72 St', edges: []}, {complexId: '2', name: '72 St', edges: []}]
    expect(matchStation(stations, '72 St')).toEqual(stations)
  })

  it('disambiguates stations with the same name when subway line is included in the query', () => {
    const qStation = {complexId: '1', name: '72 St', lines: ['Q'], edges: []}
    const bwayStation = {complexId: '2', name: '72 St', lines: ['1', '2', '3'], edges: []}
    expect(matchStation([qStation, bwayStation], '72 St Q')).toEqual([qStation])
    expect(matchStation([qStation, bwayStation], '72 St 1')).toEqual([bwayStation])
  })

  it('normalizes common transit contractions like Center -> Ctr', () => {
    const barclays = {complexId: '617', name: 'Atlantic Av-Barclays Ctr', edges: []}
    expect(matchStation([barclays], 'Barclays Center')).toEqual([barclays])
  })
})

describe('resolveStation', () => {
  const q = {complexId: '1', name: '72 St', lines: ['Q'], borough: 'M', edges: []}
  const bway = {complexId: '2', name: '72 St', lines: ['1', '2', '3'], borough: 'M', edges: []}
  const cpw = {complexId: '3', name: '72 St', lines: ['B', 'C'], borough: 'M', edges: []}
  const penn = {complexId: '4', name: '34 St-Penn Station', lines: ['A', 'C', 'E'], edges: []}
  const herald = {complexId: '5', name: '34 St-Herald Sq', lines: ['B', 'D', 'F', 'M'], edges: []}
  const all = [q, bway, cpw, penn, herald]

  it('asks instead of choosing when several stations share a name', () => {
    expect(resolveStation(all, '72 St')).toEqual({kind: 'ambiguous', candidates: [q, bway, cpw]})
  })

  it('asks instead of choosing between different loose matches', () => {
    const r = resolveStation(all, '34 st')
    expect(r.kind).toBe('ambiguous')
    expect(r.kind === 'ambiguous' && r.candidates.map((c) => c.complexId).sort()).toEqual(['4', '5'])
  })

  it('uses a single match directly', () => {
    expect(resolveStation(all, '72 St Q')).toEqual({kind: 'match', complex: q})
  })

  it('uses a chosen complexId so a clarification persists through follow-ups', () => {
    expect(resolveStation(all, '72 St', '2')).toEqual({kind: 'match', complex: bway})
  })

  it('ignores an unknown complexId rather than trusting it', () => {
    expect(resolveStation(all, '72 St', '999').kind).toBe('ambiguous')
  })

  it('reports no match', () => {
    expect(resolveStation(all, 'Atlantis')).toEqual({kind: 'none'})
  })
})

describe('cleanStationName', () => {
  it('drops the generic "- Station" suffix so same-name stops match together', () => {
    expect(cleanStationName('72 St - Station')).toBe('72 St')
    expect(cleanStationName('Inwood-207 St - Station')).toBe('Inwood-207 St')
    expect(cleanStationName('34 St-Penn Station')).toBe('34 St-Penn Station')
  })
})

describe('loadNetwork', () => {
  function snapshot(updatedAt: string | null): void {
    fetchNetwork
      .mockResolvedValueOnce([]) // complexes
      .mockResolvedValueOnce([]) // outages
      .mockResolvedValueOnce([]) // equipment
      .mockResolvedValueOnce(updatedAt) // sourceUpdatedAt
  }

  it('cleans station names so "72 St" finds every 72 St', async () => {
    fetchNetwork
      .mockResolvedValueOnce([{complexId: '313', name: '72 St - Station', edges: []}, {complexId: '160', name: '72 St', edges: []}])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(new Date().toISOString())
    const {complexes} = await loadNetwork()
    expect(resolveStation(complexes, '72 St').kind).toBe('ambiguous')
  })

  it('reports the source refresh time separately from the request time', async () => {
    const updatedAt = new Date(Date.now() - 5 * 60_000).toISOString()
    snapshot(updatedAt)
    expect(await loadNetwork()).toMatchObject({sourceUpdatedAt: updatedAt})
  })

  it('refuses routing data older than an hour', async () => {
    snapshot(new Date(Date.now() - 61 * 60_000).toISOString())
    await expect(loadNetwork()).rejects.toThrow('outage data')
  })

  it('refuses routing data with an unknown refresh time', async () => {
    snapshot(null)
    await expect(loadNetwork()).rejects.toThrow('outage data')
  })
})
