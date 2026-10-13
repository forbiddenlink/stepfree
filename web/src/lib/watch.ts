// Commute watches: a rider saves a step-free route and gets one email when an accessible
// elevator at a station where they board, transfer, or alight goes out.
//
// Shared by the web app (sign-up, confirm, stop) and ingest/notify.ts (the alert sender), so
// this module uses relative imports only. Watches live in the PRIVATE `watches` dataset: the
// public `production` dataset (and therefore the Context MCP agent) never sees an email.
import {createHash, randomBytes} from 'node:crypto'
import {createClient, type SanityClient} from '@sanity/client'

export type WatchStatus = 'pending' | 'active' | 'stopped'
export type Watch = {
  _id: string
  _type: 'watch'
  email: string
  emailHash: string
  tokenHash: string // confirm token, hashed
  stopToken: string // unsubscribe only; stored plain so the alert job can build stop links
  status: WatchStatus
  fromId: string
  toId: string
  fromName: string
  toName: string
  keyComplexes: string[]
  createdAt: string
  confirmedAt?: string
  notified?: string[] // outage _ids already emailed, so each outage alerts once
}

export type AlertOutage = {
  _id: string
  complexId: string
  stationName: string
  equipmentNo: string
  status: 'active' | 'upcoming'
  startsAt?: string
  estimatedReturnAt?: string
  reason?: string
  alternativeRoute?: string
}

export const SITE_URL = process.env.STEPFREE_SITE_URL ?? 'https://stepfree-alpha.vercel.app'
const FROM = process.env.STEPFREE_FROM ?? 'StepFree <alerts@elizabethannstein.com>'

export function watchesClient(token: string | undefined = process.env.SANITY_WRITE_TOKEN): SanityClient {
  if (!token) throw new Error('SANITY_WRITE_TOKEN is not set')
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '19mt1buh',
    dataset: 'watches',
    apiVersion: '2026-09-01',
    useCdn: false,
    token,
  })
}

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')
export const normalizeEmail = (s: string): string => s.trim().toLowerCase()

/** Only the confirm token's hash is stored, so a leaked export cannot confirm alerts to someone else's inbox. */
export function newTokens(): {token: string; tokenHash: string; stopToken: string} {
  const token = randomBytes(24).toString('base64url')
  return {token, tokenHash: sha256(token), stopToken: randomBytes(24).toString('base64url')}
}

export const watchLink = (action: 'confirm' | 'stop', token: string): string =>
  `${SITE_URL}/watch?a=${action}&t=${encodeURIComponent(token)}`

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]!)

const nyTime = (iso?: string): string =>
  iso
    ? new Date(iso).toLocaleString('en-US', {timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short'})
    : 'unknown'

type Email = {subject: string; text: string; html: string}

export function confirmEmail(w: Pick<Watch, 'fromName' | 'toName'>, token: string): Email {
  const route = `${w.fromName} to ${w.toName}`
  const confirm = watchLink('confirm', token)
  return {
    subject: `Confirm your StepFree alert: ${route}`,
    text: `Someone (hopefully you) asked StepFree to email this address when an elevator breaks on the step-free route ${route}.\n\nConfirm: ${confirm}\n\nIf this wasn't you, ignore this email and nothing will be sent.`,
    html: `<p>Someone (hopefully you) asked StepFree to email this address when an elevator breaks on the step-free route <strong>${esc(route)}</strong>.</p><p><a href="${esc(confirm)}">Confirm the alert</a></p><p>If this wasn't you, ignore this email and nothing will be sent.</p>`,
  }
}

export function alertEmail(w: Pick<Watch, 'fromName' | 'toName' | 'stopToken'>, outages: AlertOutage[]): Email {
  const route = `${w.fromName} to ${w.toName}`
  const stop = watchLink('stop', w.stopToken)
  const line = (o: AlertOutage): string =>
    `${o.stationName}: elevator ${o.equipmentNo} ${o.status === 'upcoming' ? `planned out from ${nyTime(o.startsAt)}` : 'is out now'}` +
    ` (${o.reason ?? 'no reason given'}). Expected back ${nyTime(o.estimatedReturnAt)}.` +
    (o.alternativeRoute ? `\nMTA detour: ${o.alternativeRoute}` : '')
  const first = outages[0]
  return {
    subject: `Elevator out on your route: ${first.stationName}${outages.length > 1 ? ` and ${outages.length - 1} more` : ''}`,
    text: `An elevator you rely on for ${route} is out of service.\n\n${outages.map(line).join('\n\n')}\n\nPlan a new step-free route: ${SITE_URL}\nCheck mta.info/elevators before you leave.\n\nStop these alerts: ${stop}`,
    html:
      `<p>An elevator you rely on for <strong>${esc(route)}</strong> is out of service.</p>` +
      outages.map((o) => `<p>${esc(line(o)).replace(/\n/g, '<br>')}</p>`).join('') +
      `<p><a href="${esc(SITE_URL)}">Plan a new step-free route</a>. Check mta.info/elevators before you leave.</p>` +
      `<p style="color:#555;font-size:13px"><a href="${esc(stop)}">Stop these alerts</a></p>`,
  }
}

/** Resend over plain fetch. The idempotency key makes a retried run send at most once. */
export async function sendEmail(to: string, email: Email, idempotencyKey: string, stopUrl?: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey},
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: email.subject,
      text: email.text,
      html: email.html,
      ...(stopUrl ? {headers: {'List-Unsubscribe': `<${stopUrl}>`}} : {}),
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
}
