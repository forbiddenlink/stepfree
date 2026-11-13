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

describe('chat spend guard', () => {
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
    const {checkChatIpLimit, reserveChatSpend} = await import('./limits')
    const out: string[] = []
    for (let i = 0; i < 21; i++) out.push(await checkChatIpLimit(req()))
    expect(out[0]).toBe('ok')
    expect(out[20]).toBe('ip')
    expect(await reserveChatSpend(req())).toBe('ok')
    expect(limit).not.toHaveBeenCalled()
    expect(incr).not.toHaveBeenCalled()
  })

  describe('with Redis env', () => {
    beforeEach(() => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.invalid')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'x')
    })

    it('IP check trips on the durable limiter and does not count the daily budget', async () => {
      limit.mockResolvedValue({success: false})
      const {checkChatIpLimit} = await import('./limits')
      expect(await checkChatIpLimit(req())).toBe('ip')
      expect(incr).not.toHaveBeenCalled()
    })

    it('reserve allows under the caps and sets TTLs on first hits', async () => {
      incr.mockResolvedValue(1)
      const {reserveChatSpend} = await import('./limits')
      expect(await reserveChatSpend(req())).toBe('ok')
      expect(expire).toHaveBeenCalledTimes(2)
    })

    it('reserve returns daily over the global ceiling', async () => {
      const {reserveChatSpend, CHAT_LIMITS} = await import('./limits')
      incr.mockResolvedValueOnce(1).mockResolvedValueOnce(CHAT_LIMITS.maxRequestsPerDay + 1)
      expect(await reserveChatSpend(req())).toBe('daily')
    })

    it('reserve returns client over the per-client cap without touching the global counter', async () => {
      const {reserveChatSpend, CHAT_LIMITS} = await import('./limits')
      incr.mockResolvedValueOnce(CHAT_LIMITS.maxRequestsPerClientPerDay + 1)
      expect(await reserveChatSpend(req())).toBe('client')
      expect(incr).toHaveBeenCalledTimes(1)
    })

    it('reserve fails closed (unavailable) when Redis throws', async () => {
      incr.mockRejectedValue(new Error('boom'))
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const {reserveChatSpend} = await import('./limits')
      expect(await reserveChatSpend(req())).toBe('unavailable')
    })

    it('a spoofed X-Forwarded-For does not change the counted client key', async () => {
      incr.mockResolvedValue(1)
      const {reserveChatSpend} = await import('./limits')
      const spoof = (xff: string) => new Request('http://x', {headers: {'x-real-ip': '1.2.3.4', 'x-forwarded-for': xff}})
      await reserveChatSpend(spoof('6.6.6.6'))
      await reserveChatSpend(spoof('7.7.7.7'))
      const keys = incr.mock.calls.map((c) => c[0] as string).filter((k) => k.includes(':ip:'))
      expect(new Set(keys).size).toBe(1)
      expect(keys[0]).toContain('1.2.3.4')
    })
  })
})
