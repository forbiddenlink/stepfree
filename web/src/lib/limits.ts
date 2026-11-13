// Abuse limits for the public API routes.
//
// Durable limits (per-email confirmation cap, pending cooldown) live on the watch records in the
// Sanity `watches` dataset, so they hold across serverless instances. The IP limiter below is
// in-memory and therefore PER INSTANCE: it blunts a single noisy client, it is not a global cap.

import {Ratelimit} from '@upstash/ratelimit'
import {Redis} from '@upstash/redis'

const HOUR = 3_600_000

export const WATCH_LIMITS = {
  /** Confirmation emails per address per rolling 24h, across every route that address signs up for. */
  maxConfirmationsPerDay: 3,
  /** A pending watch is not re-sent a confirmation inside this window. */
  cooldownMs: HOUR,
  dayMs: 24 * HOUR,
}

export const CHAT_LIMITS = {
  maxMessages: 50,
  maxMessageChars: 2_000,
  maxTotalChars: 20_000,
  maxBodyBytes: 200_000,
  /** Hard cap on tokens the model may generate per step (bounds real-money spend per call). */
  maxOutputTokens: 1_000,
  /** Tool-call steps per request (was 8). Route plan + status checks + final answer fits in 4. */
  maxSteps: 4,
  /** Global ceiling on chat requests per UTC day across all instances. Durable path only (needs Redis). */
  maxRequestsPerDay: 500,
  /** Per-client (IP) ceiling per UTC day, so one client cannot exhaust the global budget. */
  maxRequestsPerClientPerDay: 60,
}

export type ConfirmDecision = 'send' | 'cooldown' | 'cap'

/** `sentAt`: every confirmation send for this email hash (all routes). `pendingLastSentAt`: last send for THIS pending watch. */
export function confirmDecision(input: {sentAt: string[]; pendingLastSentAt?: string; now: number}): ConfirmDecision {
  const {sentAt, pendingLastSentAt, now} = input
  if (pendingLastSentAt && now - Date.parse(pendingLastSentAt) < WATCH_LIMITS.cooldownMs) return 'cooldown'
  const recent = sentAt.filter((t) => now - Date.parse(t) < WATCH_LIMITS.dayMs).length
  return recent >= WATCH_LIMITS.maxConfirmationsPerDay ? 'cap' : 'send'
}

/** Fixed-window counter keyed by string. Per-instance memory; see the file header. */
export function createLimiter(opts: {limit: number; windowMs: number; maxKeys?: number}): {hit: (key: string, now?: number) => boolean} {
  const buckets = new Map<string, {start: number; count: number}>()
  const maxKeys = opts.maxKeys ?? 5_000
  return {
    hit(key, now = Date.now()) {
      const b = buckets.get(key)
      if (!b || now - b.start >= opts.windowMs) {
        if (b) buckets.delete(key)
        if (buckets.size >= maxKeys) {
          for (const [k, v] of buckets) if (now - v.start >= opts.windowMs) buckets.delete(k)
          // Still full: evict the oldest keys that are under their limit. Never evict a blocked key,
          // or flooding the table with fresh keys would reset the attacker's own counter.
          for (const [k, v] of buckets) {
            if (buckets.size < maxKeys) break
            if (v.count <= opts.limit) buckets.delete(k)
          }
          // Every remaining key is blocked. Admit the new key without tracking it: failing closed here
          // would let a flood of blocked keys lock out every new client, and dropping a block would
          // reset an attacker's counter. The durable per-email cap still bounds what gets sent.
          if (buckets.size >= maxKeys) return true
        }
        buckets.set(key, {start: now, count: 1})
        return true
      }
      b.count += 1
      return b.count <= opts.limit
    },
  }
}

/**
 * Vercel sets x-real-ip itself. The fallback takes the LAST x-forwarded-for hop (appended by the
 * nearest proxy), never the first, which is whatever the client chose to send.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  const hops = req.headers.get('x-forwarded-for')?.split(',').map((h) => h.trim()).filter(Boolean)
  return hops?.at(-1) || 'unknown'
}

/**
 * Canonical mailbox for the per-email cap, so one inbox cannot be counted as many: NFKC, lowercase,
 * drop "+tag" in the local part, and for Gmail also drop dots and fold googlemail.com.
 */
export function limitKeyEmail(email: string): string {
  const [rawLocal = '', rawDomain = ''] = email.normalize('NFKC').trim().toLowerCase().split('@')
  const domain = rawDomain === 'googlemail.com' ? 'gmail.com' : rawDomain
  let local = rawLocal.split('+')[0] ?? ''
  if (domain === 'gmail.com') local = local.replaceAll('.', '')
  return `${local}@${domain}`
}

/** Reads a request body with a hard byte cap, so a chunked body with no Content-Length cannot be unbounded. */
export async function readJsonLimited(req: Request, maxBytes: number): Promise<{ok: true; value: unknown} | {ok: false; tooLarge: boolean}> {
  if (Number(req.headers.get('content-length') ?? 0) > maxBytes) return {ok: false, tooLarge: true}
  if (!req.body) return {ok: false, tooLarge: false}
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const {done, value} = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => {})
      return {ok: false, tooLarge: true}
    }
    chunks.push(value)
  }
  try {
    return {ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8'))}
  } catch {
    return {ok: false, tooLarge: false}
  }
}

type PartLike = {type?: unknown; text?: unknown}
type MessageLike = {role?: string; parts?: PartLike[]}

const textLength = (m: MessageLike): number =>
  (m.parts ?? []).reduce((n, p) => n + (p.type === 'text' && typeof p.text === 'string' ? p.text.length : 0), 0)

/** Size of every part, text or not. The client sends the whole history, so tool or data parts on assistant messages are client-controlled too. */
const partsLength = (m: MessageLike): number =>
  (m.parts ?? []).reduce((n, p) => n + (p.type === 'text' && typeof p.text === 'string' ? p.text.length : JSON.stringify(p).length), 0)

/** Returns a rider-facing reason when the conversation is too big, else null. */
export function checkChatSize(messages: MessageLike[]): string | null {
  if (messages.length > CHAT_LIMITS.maxMessages) return 'Too many messages in this conversation. Start a new chat.'
  let total = 0
  for (const m of messages) {
    // A rider only types text. Tool, file, or data parts on a user message are an attempt to smuggle size past the text count.
    if (m.role === 'user' && (m.parts ?? []).some((p) => p.type !== 'text')) return 'Unsupported content in message.'
    const n = textLength(m)
    // Assistant replies in history can be long; only a rider-typed message gets the per-message cap.
    if (m.role === 'user' && n > CHAT_LIMITS.maxMessageChars) return 'That message is too long. Shorten it and try again.'
    total += partsLength(m)
  }
  return total > CHAT_LIMITS.maxTotalChars ? 'This conversation is too long. Start a new chat.' : null
}

const watchIp = createLimiter({limit: 5, windowMs: HOUR})
const chatIp = createLimiter({limit: 20, windowMs: 5 * 60_000})

/** False when this IP is over its per-instance budget. */
export const checkWatchIp = (req: Request): boolean => watchIp.hit(clientIp(req))
export const checkChatIp = (req: Request): boolean => chatIp.hit(clientIp(req))

let redis: Redis | null | undefined
let durableChatIp: Ratelimit | undefined

/** Redis client when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are both set, else null. */
function getRedis(): Redis | null {
  if (redis !== undefined) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  redis = url && token ? new Redis({url, token}) : null
  return redis
}

if (process.env.NODE_ENV === 'production' && !getRedis()) {
  console.warn('[limits] UPSTASH_REDIS_REST_URL/TOKEN not set: chat rate limiter is per-instance and resets on cold start; no daily spend ceiling.')
}

export type ChatIpResult = 'ok' | 'ip'

/**
 * Cheap per-IP burst limit, run before the body is parsed. Durable when Upstash env is present,
 * in-memory otherwise. A Redis error degrades to in-memory here only because this step never grants
 * permission to spend: the paid call is gated separately by reserveChatSpend, which fails closed.
 */
export async function checkChatIpLimit(req: Request): Promise<ChatIpResult> {
  const r = getRedis()
  if (!r) return checkChatIp(req) ? 'ok' : 'ip'
  try {
    durableChatIp ??= new Ratelimit({redis: r, limiter: Ratelimit.fixedWindow(20, '5 m'), prefix: 'stepfree:chat:ip'})
    const {success} = await durableChatIp.limit(clientIp(req))
    return success ? 'ok' : 'ip'
  } catch (err) {
    console.error('durable chat IP limiter failed, using in-memory:', err instanceof Error ? err.message : err)
    return checkChatIp(req) ? 'ok' : 'ip'
  }
}

export type ChatSpend = 'ok' | 'client' | 'daily' | 'unavailable'

/**
 * Call after the request body has validated, right before the paid model call. Counts one unit
 * against a per-client daily cap and the global daily ceiling.
 *
 * No Redis env: 'ok' (documented per-instance mode, no daily ceiling). Redis configured but
 * erroring: 'unavailable', and the caller must NOT call the model (fail closed).
 */
export async function reserveChatSpend(req: Request): Promise<ChatSpend> {
  const r = getRedis()
  if (!r) return 'ok'
  try {
    const day = new Date().toISOString().slice(0, 10)
    const ttl = 2 * 24 * 3600
    const clientKey = `stepfree:chat:daily:${day}:ip:${clientIp(req)}`
    const mine = await r.incr(clientKey)
    if (mine === 1) await r.expire(clientKey, ttl)
    if (mine > CHAT_LIMITS.maxRequestsPerClientPerDay) return 'client'
    const globalKey = `stepfree:chat:daily:${day}:global`
    const total = await r.incr(globalKey)
    if (total === 1) await r.expire(globalKey, ttl)
    return total > CHAT_LIMITS.maxRequestsPerDay ? 'daily' : 'ok'
  } catch (err) {
    console.error('durable chat spend counter failed, refusing paid call:', err instanceof Error ? err.message : err)
    return 'unavailable'
  }
}

type SendEntry = {w: string; t: string}
type LedgerDoc = {_id: string; _rev: string; sends?: SendEntry[]}
type LedgerClient = {
  getDocument: <T>(id: string) => Promise<(T & {_rev: string}) | undefined | null>
  create: (doc: {_id: string; _type: string; sends: SendEntry[]}) => Promise<unknown>
  patch: (id: string) => {ifRevisionId: (rev: string) => {set: (v: {sends: SendEntry[]}) => {commit: () => Promise<unknown>}}}
}

/**
 * Atomically reserves one confirmation send for (email, watch). One ledger doc per canonical email
 * holds every send, and the write is a compare-and-swap: `create` fails if the doc exists and
 * `patch(...).ifRevisionId` fails if anyone wrote since we read. Only a request whose write
 * succeeded gets 'send', so parallel requests cannot all pass the check.
 */
export async function reserveConfirmation(
  client: LedgerClient,
  ledgerId: string,
  watchId: string,
  now: number,
): Promise<ConfirmDecision> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const doc = await client.getDocument<LedgerDoc>(ledgerId)
    const sends = doc?.sends ?? []
    const pendingLast = sends.filter((e) => e.w === watchId).map((e) => e.t).sort().at(-1)
    const decision = confirmDecision({sentAt: sends.map((e) => e.t), pendingLastSentAt: pendingLast, now})
    if (decision !== 'send') return decision
    const next = [...sends.filter((e) => now - Date.parse(e.t) < WATCH_LIMITS.dayMs), {w: watchId, t: new Date(now).toISOString()}]
    try {
      if (doc) await client.patch(ledgerId).ifRevisionId(doc._rev).set({sends: next}).commit()
      else await client.create({_id: ledgerId, _type: 'watchSendLedger', sends: next})
      return 'send'
    } catch (err) {
      const status = (err as {statusCode?: number}).statusCode
      if (status !== 409 && status !== 412) throw err
      // Lost the race: re-read and re-evaluate against the winner's write.
    }
  }
  // Heavy contention is itself abuse. Fail closed: no send.
  return 'cap'
}
