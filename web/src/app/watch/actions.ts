'use server'

import {sha256, watchesClient} from '@/lib/watch'

export type ActionState = {done: boolean; message: string}

// Tokens are the only authorization here: confirm uses the hashed one-time token,
// stop uses the per-watch stop token. Unknown tokens get the same neutral reply.
export async function applyWatchAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const action = form.get('a')
  const token = String(form.get('t') ?? '')
  if (!token || token.length > 64 || (action !== 'confirm' && action !== 'stop')) {
    return {done: false, message: 'This link is not valid.'}
  }
  const client = watchesClient()
  if (action === 'confirm') {
    const watch = await client.fetch<{_id: string; status: string; createdAt: string} | null>(
      `*[_type == "watch" && tokenHash == $h][0]{_id, status, createdAt}`,
      {h: sha256(token)},
    )
    if (!watch) return {done: false, message: 'This link is not valid or has expired.'}
    if (watch.status === 'stopped') {
      return {done: false, message: 'This alert was previously stopped. Please sign up again to start new alerts.'}
    }
    const ageMs = Date.now() - new Date(watch.createdAt).getTime()
    if (Number.isFinite(ageMs) && ageMs > 48 * 60 * 60 * 1000) {
      return {done: false, message: 'This confirmation link has expired. Please sign up again.'}
    }
    await client
      .patch(watch._id)
      .set({status: 'active', confirmedAt: new Date().toISOString()})
      .unset(['tokenHash'])
      .commit()
    return {done: true, message: 'Alerts are on. We will email you once for each elevator that goes out on your route.'}
  }
  const id = await client.fetch<string | null>(`*[_type == "watch" && stopToken == $t][0]._id`, {t: token})
  if (id) {
    await client.patch(id).set({status: 'stopped'}).unset(['tokenHash']).commit()
  }
  return {done: true, message: 'Alerts are off for this route. You will not get more emails about it.'}
}
