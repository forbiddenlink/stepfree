import {describe, expect, it} from 'vitest'
import {CHAT_LIMITS, checkChatSize, clientIp, confirmDecision, createLimiter, limitKeyEmail, readJsonLimited} from './limits'

const H = 3_600_000
const now = Date.parse('2026-10-13T12:00:00Z')
const ago = (ms: number): string => new Date(now - ms).toISOString()

describe('confirmDecision', () => {
  it('sends the first confirmation', () => {
    expect(confirmDecision({sentAt: [], now})).toBe('send')
  })

  it('does not re-send a pending watch inside the 1 hour cooldown', () => {
    expect(confirmDecision({sentAt: [ago(10 * 60_000)], pendingLastSentAt: ago(10 * 60_000), now})).toBe('cooldown')
  })

  it('re-sends a pending watch once the cooldown has passed', () => {
    expect(confirmDecision({sentAt: [ago(H + 1)], pendingLastSentAt: ago(H + 1), now})).toBe('send')
  })

  it('caps confirmations at 3 per email per 24h across all routes', () => {
    const sentAt = [ago(2 * H), ago(5 * H), ago(8 * H)]
    expect(confirmDecision({sentAt, now})).toBe('cap')
  })

  it('ignores sends older than 24h when counting the cap', () => {
    const sentAt = [ago(25 * H), ago(26 * H), ago(27 * H), ago(2 * H)]
    expect(confirmDecision({sentAt, now})).toBe('send')
  })
})

describe('createLimiter', () => {
  it('allows up to the limit then blocks, per key', () => {
    const l = createLimiter({limit: 2, windowMs: 1000})
    expect([l.hit('a', 0), l.hit('a', 1), l.hit('a', 2)]).toEqual([true, true, false])
    expect(l.hit('b', 2)).toBe(true)
  })

  it('resets after the window', () => {
    const l = createLimiter({limit: 1, windowMs: 1000})
    l.hit('a', 0)
    expect(l.hit('a', 1001)).toBe(true)
  })
})

describe('clientIp', () => {
  it('prefers x-real-ip, then the LAST x-forwarded-for hop (the first is client-chosen)', () => {
    expect(clientIp(new Request('http://x', {headers: {'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2'}}))).toBe('1.1.1.1')
    expect(clientIp(new Request('http://x', {headers: {'x-forwarded-for': '6.6.6.6, 3.3.3.3'}}))).toBe('3.3.3.3')
    expect(clientIp(new Request('http://x'))).toBe('unknown')
  })
})

const msg = (role: string, text: string) => ({id: 'i', role, parts: [{type: 'text', text}]})

describe('checkChatSize', () => {
  it('accepts a normal conversation', () => {
    expect(checkChatSize([msg('user', 'Is the elevator at 72 St working?')])).toBeNull()
  })

  it('rejects one oversized message', () => {
    expect(checkChatSize([msg('user', 'x'.repeat(CHAT_LIMITS.maxMessageChars + 1))])).toMatch(/too long/i)
  })

  it('rejects when total characters exceed the cap', () => {
    const each = 'y'.repeat(CHAT_LIMITS.maxMessageChars)
    const many = Array.from({length: Math.ceil(CHAT_LIMITS.maxTotalChars / CHAT_LIMITS.maxMessageChars) + 1}, () => msg('user', each))
    expect(checkChatSize(many)).toMatch(/too long/i)
  })

  it('rejects too many messages', () => {
    expect(checkChatSize(Array.from({length: CHAT_LIMITS.maxMessages + 1}, () => msg('user', 'hi')))).toMatch(/too many/i)
  })
})

describe('limitKeyEmail', () => {
  it('collapses plus tags, case, gmail dots and googlemail', () => {
    const k = limitKeyEmail('jane.doe@gmail.com')
    for (const v of ['JaneDoe+a@gmail.com', 'j.a.n.e.d.o.e+b@googlemail.com', ' janedoe@GMAIL.COM ']) expect(limitKeyEmail(v)).toBe(k)
  })
  it('keeps dots significant on other domains', () => {
    expect(limitKeyEmail('a.b@example.com')).not.toBe(limitKeyEmail('ab@example.com'))
  })
})

describe('readJsonLimited', () => {
  it('stops reading a chunked body past the cap', async () => {
    const body = new ReadableStream({start(c) { c.enqueue(new Uint8Array(600)); c.enqueue(new Uint8Array(600)); c.close() }})
    const r = await readJsonLimited(new Request('http://x', {method: 'POST', body, duplex: 'half'} as RequestInit), 1000)
    expect(r).toEqual({ok: false, tooLarge: true})
  })
  it('parses a small body', async () => {
    expect(await readJsonLimited(new Request('http://x', {method: 'POST', body: '{"a":1}'}), 1000)).toEqual({ok: true, value: {a: 1}})
  })
})

describe('checkChatSize part smuggling', () => {
  it('rejects non-text parts on a user message', () => {
    expect(checkChatSize([{role: 'user', parts: [{type: 'file'}]}])).toMatch(/unsupported/i)
  })
})
