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
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">StepFree alerts</h1>
      <div className="mt-6">
        {action && token ? (
          <>
            <p className="mb-4 text-muted">
              {action === 'confirm'
                ? 'Get one email when an accessible elevator breaks at a station where you board, transfer, or get off.'
                : 'Stop elevator alerts for this route.'}
            </p>
            <WatchAction action={action} token={token} />
          </>
        ) : (
          <p role="alert">This link is not valid.</p>
        )}
      </div>
      <p className="mt-8">
        <Link href="/" className="underline">
          Plan a step-free trip
        </Link>
      </p>
    </main>
  )
}
