import {afterEach, describe, expect, it, vi} from 'vitest'
import {loadNetwork, matchStation} from './data'

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

describe('loadNetwork', () => {
  function snapshot(updatedAt: string | null): void {
    fetchNetwork
      .mockResolvedValueOnce([]) // complexes
      .mockResolvedValueOnce([]) // outages
      .mockResolvedValueOnce([]) // equipment
      .mockResolvedValueOnce(updatedAt) // sourceUpdatedAt
  }

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
