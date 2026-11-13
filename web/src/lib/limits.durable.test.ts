import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const incr = vi.fn()
const expire = vi.fn()
const limit = vi.fn()

vi.mock('@upstash/redis', () => ({Redis: class {incr = incr; expire = expire}}))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static fixedWindow = vi.fn(() => 'fw')
    limit = limit
  },
}))

const req = () => new Request('http://x', {headers: {'x-real-ip': '9.9.9.9'}})

describe('checkChatBudget', () => {
  beforeEach(() => {
    vi.resetModules()
    incr.mockReset()
    expire.mockReset()
    limit.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('has bounded spend constants', async () => {
    const {CHAT_LIMITS} = await import('./limits')
    expect(CHAT_LIMITS.maxOutputTokens).toBeLessThanOrEqual(1_200)
    expect(CHAT_LIMITS.maxSteps).toBe(4)
  })

  it('uses the in-memory limiter without Redis env and never calls Redis', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    const {checkChatBudget} = await import('./limits')
    const out: string[] = []
    for (let i = 0; i < 21; i++) out.push(await checkChatBudget(req()))
    expect(out[0]).toBe('ok')
    expect(out[20]).toBe('ip')
    expect(limit).not.toHaveBeenCalled()
    expect(incr).not.toHaveBeenCalled()
  })

  describe('with Redis env', () => {
    beforeEach(() => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.invalid')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'x')
    })

    it('allows under the daily ceiling and sets a TTL on the first hit', async () => {
      limit.mockResolvedValue({success: true})
      incr.mockResolvedValue(1)
      const {checkChatBudget} = await import('./limits')
      expect(await checkChatBudget(req())).toBe('ok')
      expect(expire).toHaveBeenCalledTimes(1)
    })

    it('returns daily once over the ceiling', async () => {
      limit.mockResolvedValue({success: true})
      const {checkChatBudget, CHAT_LIMITS} = await import('./limits')
      incr.mockResolvedValue(CHAT_LIMITS.maxRequestsPerDay + 1)
      expect(await checkChatBudget(req())).toBe('daily')
    })

    it('returns ip when the durable per-IP limit trips, without counting the day', async () => {
      limit.mockResolvedValue({success: false})
      const {checkChatBudget} = await import('./limits')
      expect(await checkChatBudget(req())).toBe('ip')
      expect(incr).not.toHaveBeenCalled()
    })

    it('falls back to in-memory when Redis throws', async () => {
      limit.mockRejectedValue(new Error('boom'))
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const {checkChatBudget} = await import('./limits')
      expect(await checkChatBudget(req())).toBe('ok')
    })
  })
})
