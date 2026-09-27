import type {Metadata} from 'next'
import Link from 'next/link'
import {WatchAction} from './WatchAction'

export const metadata: Metadata = {title: 'StepFree alerts', robots: {index: false}}

// A button, not an auto-action on load: mail scanners open links, and a GET must never confirm or stop anything.
export default async function WatchPage({searchParams}: PageProps<'/watch'>): Promise<React.JSX.Element> {
  const {a, t} = await searchParams
  const action = a === 'confirm' || a === 'stop' ? a : undefined
  const token = typeof t === 'string' ? t : undefined
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-10">
      <Link href="/" className="text-2xl font-bold tracking-tight hover:opacity-80">
        StepFree
      </Link>
      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-xs">
        <h1 className="text-xl font-bold tracking-tight">StepFree alerts</h1>
        <div className="mt-4">
          {action && token ? (
            <>
              <p className="mb-4 text-sm text-muted leading-relaxed">
                {action === 'confirm'
                  ? 'Get one email when an accessible elevator breaks at a station where you board, transfer, or get off.'
                  : 'Stop elevator alerts for this route.'}
              </p>
              <WatchAction action={action} token={token} />
            </>
          ) : (
            <p role="alert" className="rounded-xl bg-bad/10 p-3.5 text-sm font-medium text-bad">
              This link is not valid.
            </p>
          )}
        </div>
      </section>
      <p className="mt-6 text-center text-sm">
        <Link href="/" className="font-semibold text-accent underline hover:opacity-80">
          Plan a step-free trip
        </Link>
      </p>
    </main>
  )
}
