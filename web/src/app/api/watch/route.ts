import {z} from 'zod'
import {findStepFreeRoute} from '@/lib/graph'
import {loadNetwork} from '@/lib/data'
import {checkWatchIp, confirmDecision} from '@/lib/limits'
import {confirmEmail, newTokens, normalizeEmail, sendEmail, sha256, watchesClient, watchLink} from '@/lib/watch'

const Body = z.object({
  email: z.email().max(254),
  fromId: z.string().min(1).max(20),
  toId: z.string().min(1).max(20),
})

// Same reply whether or not the address is new, so the endpoint can't be used to probe who has alerts.
const ACCEPTED = {ok: true, message: 'Check your inbox and confirm to start alerts.'}

export async function POST(req: Request): Promise<Response> {
  if (!checkWatchIp(req)) {
    return Response.json({ok: false, message: 'Too many requests. Try again later.'}, {status: 429, headers: {'Retry-After': '3600'}})
  }
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ok: false, message: 'Enter a valid email address.'}, {status: 400})
  const {fromId, toId} = parsed.data
  const email = normalizeEmail(parsed.data.email)

  const {complexes, outages} = await loadNetwork()
  const route = findStepFreeRoute(complexes, outages, fromId, toId, new Date())
  const byId = new Map(complexes.map((c) => [c.complexId, c.name]))
  if (!route.ok || !byId.has(fromId) || !byId.has(toId)) {
    return Response.json({ok: false, message: 'There is no step-free route to watch between those stations right now.'}, {status: 422})
  }

  const client = watchesClient()
  const emailHash = sha256(email)
  // One watch per address per route: a repeat sign-up re-sends the confirmation instead of duplicating.
  const _id = `watch-${sha256(`${emailHash}:${fromId}:${toId}`).slice(0, 24)}`
  const existing = await client.getDocument<{status: string; confirmSentAt?: string[]}>(_id)
  if (existing?.status === 'active') return Response.json(ACCEPTED)

  // Durable abuse limits, kept on the watch records so they hold across instances. Every branch
  // returns ACCEPTED, so the reply never reveals whether an address is known or throttled.
  const now = Date.now()
  const sentAt = ((await client.fetch<(string[] | null)[]>('*[_type=="watch" && emailHash==$h].confirmSentAt', {h: emailHash})) ?? []).flatMap((a) => a ?? [])
  const decision = confirmDecision({
    sentAt,
    pendingLastSentAt: existing?.status === 'pending' ? existing.confirmSentAt?.at(-1) : undefined,
    now,
  })
  if (decision !== 'send') return Response.json(ACCEPTED)

  const {token, tokenHash, stopToken} = newTokens()
  const watch = {fromId, toId, fromName: byId.get(fromId)!, toName: byId.get(toId)!}
  await client.createOrReplace({
    _id,
    _type: 'watch',
    ...watch,
    email,
    emailHash,
    tokenHash,
    stopToken,
    status: 'pending',
    keyComplexes: route.keyComplexes,
    createdAt: new Date(now).toISOString(),
    confirmSentAt: [...(existing?.confirmSentAt ?? []), new Date(now).toISOString()].slice(-10),
    notified: [],
  })
  await sendEmail(email, confirmEmail(watch, token), `confirm-${tokenHash}`, watchLink('stop', stopToken))
  return Response.json(ACCEPTED)
}
