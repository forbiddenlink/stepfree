import {beforeEach, describe, expect, it, vi} from 'vitest'

const sendEmail = vi.fn(async () => {})
const docs = new Map<string, Record<string, unknown>>()
const client = {
  getDocument: vi.fn(async (id: string) => docs.get(id) ?? null),
  createOrReplace: vi.fn(async (d: Record<string, unknown> & {_id: string}) => {
    docs.set(d._id, d)
    return d
  }),
  fetch: vi.fn(async (_q: string, params: {h: string}) =>
    [...docs.values()].filter((d) => d.emailHash === params.h).map((d) => d.confirmSentAt ?? []),
  ),
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
    vi.useFakeTimers()
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
})
