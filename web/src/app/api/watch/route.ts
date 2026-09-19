import {z} from 'zod'
import {findStepFreeRoute} from '@/lib/graph'
import {loadNetwork} from '@/lib/data'
import {confirmEmail, newTokens, normalizeEmail, sendEmail, sha256, watchesClient, watchLink} from '@/lib/watch'

const Body = z.object({
  email: z.email().max(254),
  fromId: z.string().min(1).max(20),
  toId: z.string().min(1).max(20),
})

// Same reply whether or not the address is new, so the endpoint can't be used to probe who has alerts.
const ACCEPTED = {ok: true, message: 'Check your inbox and confirm to start alerts.'}

export async function POST(req: Request): Promise<Response> {
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
  const existing = await client.getDocument<{status: string}>(_id)
  if (existing?.status === 'active') return Response.json(ACCEPTED)

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
    createdAt: new Date().toISOString(),
    notified: [],
  })
  await sendEmail(email, confirmEmail(watch, token), `confirm-${tokenHash}`, watchLink('stop', stopToken))
  return Response.json(ACCEPTED)
}
