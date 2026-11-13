import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const incr = vi.fn()
const expire = vi.fn()
const limit = vi.fn()
const streamText = vi.fn()

vi.mock('@upstash/redis', () => ({Redis: class {incr = incr; expire = expire}}))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static fixedWindow = vi.fn(() => 'fw')
    limit = limit
  },
}))
vi.mock('ai', async (orig) => ({...(await orig<typeof import('ai')>()), streamText}))

const user = (text: string) => ({id: '1', role: 'user', parts: [{type: 'text', text}]})
const post = (messages: unknown[]) =>
  new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-real-ip': '5.5.5.5'},
    body: JSON.stringify({messages}),
  })

describe('POST /api/chat spend guard with Redis configured', () => {
  beforeEach(() => {
    vi.resetModules()
    ;[incr, expire, limit, streamText].forEach((m) => m.mockReset())
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.invalid')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'x')
    vi.stubEnv('SANITY_CONTEXT_TOKEN', 'tok')
    limit.mockResolvedValue({success: true})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.unstubAllEnvs())

  it('returns 503 and never reaches the model when the Redis counter throws', async () => {
    incr.mockRejectedValue(new Error('redis down'))
    const {POST} = await import('./route')
    expect((await POST(post([user('hi')]))).status).toBe(503)
    expect(streamText).not.toHaveBeenCalled()
  })

  it('does not count the daily budget when the body fails validation', async () => {
    const {POST} = await import('./route')
    expect((await POST(post([]))).status).toBe(400)
    expect((await POST(post([user('x'.repeat(2_001))]))).status).toBe(413)
    expect(incr).not.toHaveBeenCalled()
  })

  it('returns 429 when the per-client daily cap is exceeded', async () => {
    incr.mockResolvedValue(61)
    const {POST} = await import('./route')
    expect((await POST(post([user('hi')]))).status).toBe(429)
    expect(streamText).not.toHaveBeenCalled()
  })
})
