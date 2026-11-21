import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {GET} from './route'
import {captureMessage} from '@sentry/nextjs'

const {fetchTimestamp} = vi.hoisted(() => ({fetchTimestamp: vi.fn<() => Promise<string | null>>()}))
vi.mock('@/lib/data', () => ({sanity: {fetch: fetchTimestamp}}))
vi.mock('@sentry/nextjs', () => ({captureMessage: vi.fn(), flush: vi.fn()}))

describe('outage feed freshness', () => {
  const request = new Request('https://example.test/api/feed-health', {
    headers: {authorization: 'Bearer test'},
  })
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-20T12:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.resetAllMocks() })

  it('requires the cron credential before reading the feed', async () => {
    expect((await GET(new Request(request.url))).status).toBe(401)
    expect(fetchTimestamp).not.toHaveBeenCalled()
  })

  it('accepts the last successful commit up to 45 minutes old', async () => {
    fetchTimestamp.mockResolvedValue('2026-11-20T11:15:00Z')
    expect((await GET(request)).status).toBe(204)
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it.each([null, 'invalid', '2026-11-20T11:14:59Z', '2026-11-20T12:01:00Z'])(
    'alerts for an unusable or stale timestamp (%s)', async value => {
      fetchTimestamp.mockResolvedValue(value)
      expect((await GET(request)).status).toBe(503)
      expect(captureMessage).toHaveBeenCalledOnce()
    },
  )

  it('alerts if the ingest record cannot be read', async () => {
    fetchTimestamp.mockRejectedValue(new Error('unavailable'))
    expect((await GET(request)).status).toBe(503)
    expect(captureMessage).toHaveBeenCalledOnce()
  })
})
