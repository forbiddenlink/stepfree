import {captureMessage, flush} from '@sentry/nextjs'
import {sanity} from '@/lib/data'

const allowance = 45 * 60 * 1000

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response(null, {status: 401})
  }

  let finishedAt: string | null
  try {
    finishedAt = await sanity.fetch<string | null>(
      '*[_id == "ingestrun-outages"][0].finishedAt', {}, {cache: 'no-store'},
    )
  } catch {
    finishedAt = null
  }
  const age = finishedAt ? Date.now() - Date.parse(finishedAt) : NaN
  if (age >= 0 && age <= allowance) return new Response(null, {status: 204})

  captureMessage('StepFree outage feed freshness check failed', 'error')
  await flush(2000)
  return new Response(null, {status: 503})
}
