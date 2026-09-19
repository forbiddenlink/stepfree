'use client'

import {useActionState} from 'react'
import {applyWatchAction, type ActionState} from './actions'

export function WatchAction({action, token}: {action: 'confirm' | 'stop'; token: string}): React.JSX.Element {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(applyWatchAction, {done: false, message: ''})
  if (state.done) {
    return (
      <p role="status" className="rounded-xl border border-line bg-surface p-4">
        {state.message}
      </p>
    )
  }
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="a" value={action} />
      <input type="hidden" name="t" value={token} />
      <button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-white disabled:opacity-50">
        {action === 'confirm' ? 'Turn on elevator alerts' : 'Stop these alerts'}
      </button>
      {state.message && (
        <p role="alert" className="text-bad">
          {state.message}
        </p>
      )}
    </form>
  )
}
