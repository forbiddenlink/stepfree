// Runs against the live public dataset. Skipped unless LIVE=1 so CI stays offline-safe.
import {describe, expect, it} from 'vitest'
import {findStepFreeRoute} from './graph'
import {loadNetwork, matchStation} from './data'

describe.runIf(process.env.LIVE === '1')('live MTA network', () => {
  it('routes step-free across real stations and reports what it used', async () => {
    const {complexes, outages} = await loadNetwork()
    expect(complexes.length).toBeGreaterThan(400)
    const from = matchStation(complexes, '1 Av')[0]
    const to = matchStation(complexes, 'Times Sq')[0]
    const r = findStepFreeRoute(complexes, outages, from.complexId, to.complexId, new Date())
    console.log(from.name, '->', to.name, JSON.stringify(r, null, 1).slice(0, 1500))
    expect(r.ok).toBe(true)
  }, 30_000)
})
