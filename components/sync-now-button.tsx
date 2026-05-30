'use client';

import { useActionState } from 'react';
import { syncNowAction, type SyncActionResult } from '@/modules/sync/actions';

export function SyncNowButton() {
  const [state, formAction, pending] = useActionState<
    SyncActionResult | null,
    FormData
  >(syncNowAction, null);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? 'Syncing…' : 'Sync now'}
        </button>
      </form>
      {state && (
        <div
          className={`rounded-md p-3 text-sm ${
            state.ok
              ? state.severity === 'warning'
                ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                : 'bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-300'
              : 'bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-300'
          }`}
        >
          <p className="font-medium">{state.ok ? state.message : state.error}</p>
          {state.ok && state.summary && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs">Full summary</summary>
              <pre className="mt-1 overflow-x-auto text-xs">
                {JSON.stringify(state.summary, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
