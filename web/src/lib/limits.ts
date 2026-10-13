// Abuse limits for the public API routes.
//
// Durable limits (per-email confirmation cap, pending cooldown) live on the watch records in the
// Sanity `watches` dataset, so they hold across serverless instances. The IP limiter below is
// in-memory and therefore PER INSTANCE: it blunts a single noisy client, it is not a global cap.

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
        if (buckets.size >= maxKeys) {
          for (const [k, v] of buckets) if (now - v.start >= opts.windowMs) buckets.delete(k)
          if (buckets.size >= maxKeys) buckets.clear()
        }
        buckets.set(key, {start: now, count: 1})
        return true
      }
      b.count += 1
      return b.count <= opts.limit
    },
  }
}

/** Vercel sets x-real-ip and overwrites x-forwarded-for, so neither is client-spoofable there. */
export function clientIp(req: Request): string {
  return req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

type PartLike = {type?: unknown; text?: unknown}
type MessageLike = {role?: string; parts?: PartLike[]}

const textLength = (m: MessageLike): number =>
  (m.parts ?? []).reduce((n, p) => n + (p.type === 'text' && typeof p.text === 'string' ? p.text.length : 0), 0)

/** Returns a rider-facing reason when the conversation is too big, else null. */
export function checkChatSize(messages: MessageLike[]): string | null {
  if (messages.length > CHAT_LIMITS.maxMessages) return 'Too many messages in this conversation. Start a new chat.'
  let total = 0
  for (const m of messages) {
    const n = textLength(m)
    // Assistant replies in history can be long; only a rider-typed message gets the per-message cap.
    if (m.role === 'user' && n > CHAT_LIMITS.maxMessageChars) return 'That message is too long. Shorten it and try again.'
    total += n
  }
  return total > CHAT_LIMITS.maxTotalChars ? 'This conversation is too long. Start a new chat.' : null
}

const watchIp = createLimiter({limit: 5, windowMs: HOUR})
const chatIp = createLimiter({limit: 20, windowMs: 5 * 60_000})

/** False when this IP is over its per-instance budget. */
export const checkWatchIp = (req: Request): boolean => watchIp.hit(clientIp(req))
export const checkChatIp = (req: Request): boolean => chatIp.hit(clientIp(req))
