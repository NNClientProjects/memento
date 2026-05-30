'use client';

import { useActionState } from 'react';
import { reconcileNowAction, type ReconcileResult } from '@/modules/sync/actions';

export function ReconcileNowButton() {
  const [state, formAction, pending] = useActionState<
    ReconcileResult | null,
    FormData
  >(reconcileNowAction, null);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {pending ? 'Reconciling…' : 'Reconcile pending writebacks'}
        </button>
      </form>
      {state && (
        <div
          className={`rounded-md p-3 text-xs ${
            state.ok
              ? state.severity === 'warning'
                ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                : 'bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-300'
              : 'bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-300'
          }`}
        >
          {state.ok ? state.message : state.error}
        </div>
      )}
    </div>
  );
}
