import {beforeEach, describe, expect, it, vi} from 'vitest'

const sendEmail = vi.fn(async () => {})
const docs = new Map<string, Record<string, unknown>>()
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))
const conflict = (): Error => Object.assign(new Error('conflict'), {statusCode: 409})
let rev = 0
// Mimics Sanity: create fails if the doc exists, patch.ifRevisionId fails if the revision moved.
// The awaits between read and write let parallel requests interleave like real network calls.
const client = {
  getDocument: vi.fn(async (id: string) => {
    await tick()
    const d = docs.get(id)
    return d ? structuredClone(d) : null
  }),
  createOrReplace: vi.fn(async (d: Record<string, unknown> & {_id: string}) => {
    await tick()
    docs.set(d._id, {...d, _rev: String(++rev)})
    return d
  }),
  create: vi.fn(async (d: Record<string, unknown> & {_id: string}) => {
    await tick()
    if (docs.has(d._id)) throw conflict()
    docs.set(d._id, {...d, _rev: String(++rev)})
    return d
  }),
  patch: (id: string) => ({
    ifRevisionId: (r: string) => ({
      set: (v: Record<string, unknown>) => ({
        commit: async () => {
          await tick()
          const d = docs.get(id)
          if (!d || d._rev !== r) throw conflict()
          docs.set(id, {...d, ...v, _rev: String(++rev)})
        },
      }),
    }),
  }),
}

vi.mock('@/lib/watch', async (orig) => ({
  ...(await orig<typeof import('@/lib/watch')>()),
  watchesClient: () => client,
  sendEmail: (...a: unknown[]) => (sendEmail as (...x: unknown[]) => Promise<void>)(...a),
}))
vi.mock('@/lib/data', () => ({
  loadNetwork: async () => ({complexes: [{complexId: 'A', name: 'A St'}, {complexId: 'B', name: 'B St'}], outages: []}),
}))
vi.mock('@/lib/graph', () => ({findStepFreeRoute: () => ({ok: true, keyComplexes: ['A', 'B']})}))

import {POST} from './route'

let ip = 0
const post = (email: string, fromId = 'A', toId = 'B', addr = `10.0.0.${++ip}`): Promise<Response> =>
  POST(
    new Request('http://localhost/api/watch', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-real-ip': addr},
      body: JSON.stringify({email, fromId, toId}),
    }),
  )

beforeEach(() => {
  docs.clear()
  sendEmail.mockClear()
  vi.useRealTimers()
})

describe('POST /api/watch abuse limits', () => {
  it('sends one confirmation and returns the generic reply', async () => {
    const res = await post('a@example.com')
    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('does not re-send for a pending watch inside the cooldown, with an identical reply', async () => {
    const first = await (await post('a@example.com')).json()
    const second = await (await post('a@example.com')).json()
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
  })

  it('re-sends after the cooldown but stops at 3 confirmations per email per 24h', async () => {
    vi.useFakeTimers({toFake: ['Date']})
    vi.setSystemTime(new Date('2026-10-13T00:00:00Z'))
    for (let i = 0; i < 5; i++) {
      await post('a@example.com')
      vi.setSystemTime(Date.now() + 61 * 60_000)
    }
    expect(sendEmail).toHaveBeenCalledTimes(3)
  })

  it('counts the cap across different routes for the same address', async () => {
    await post('a@example.com', 'A', 'B')
    await post('a@example.com', 'B', 'A')
    await post('a@example.com', 'A', 'A')
    await post('a@example.com', 'B', 'B')
    expect(sendEmail).toHaveBeenCalledTimes(3)
  })

  it('rate limits one IP across many addresses with 429', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 8; i++) statuses.push((await post(`v${i}@example.com`, 'A', 'B', '9.9.9.9')).status)
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
    expect(sendEmail.mock.calls.length).toBeLessThanOrEqual(5)
  })

  it('parallel requests for one address and route send exactly one confirmation', async () => {
    await Promise.all(Array.from({length: 12}, () => post('race@example.com')))
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('parallel requests across routes never send more than the 3 per day cap', async () => {
    const routes: [string, string][] = [['A', 'B'], ['B', 'A'], ['A', 'A'], ['B', 'B']]
    await Promise.all(Array.from({length: 16}, (_, i) => post('race2@example.com', ...routes[i % 4]!)))
    expect(sendEmail).toHaveBeenCalledTimes(3)
  })

  it('counts plus-addressing, case, and gmail dots as the same inbox', async () => {
    await post('Jane.Doe@gmail.com', 'A', 'B')
    await post('janedoe+1@gmail.com', 'B', 'A')
    await post('j.a.n.e.d.o.e+x@googlemail.com', 'A', 'A')
    await post(' JANEDOE+4@GMAIL.com ', 'B', 'B')
    expect(sendEmail).toHaveBeenCalledTimes(3)
  })

  it('rejects an oversized body even without Content-Length', async () => {
    const big = new TextEncoder().encode(JSON.stringify({email: 'a@example.com', fromId: 'A', toId: 'B', pad: 'x'.repeat(5_000)}))
    const body = new ReadableStream({start(c) { c.enqueue(big); c.close() }})
    const res = await POST(new Request('http://localhost/api/watch', {method: 'POST', headers: {'x-real-ip': '8.8.8.8'}, body, duplex: 'half'} as RequestInit))
    expect(res.status).toBe(413)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
