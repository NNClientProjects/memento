'use client';

import { useActionState } from 'react';
import {
  confirmUnsubscribeAction,
  resubscribeAction,
  type UnsubscribeResult,
} from '@/app/u/[token]/actions';

export function UnsubscribeForm({
  token,
  channel,
  initiallyOptedOut,
}: {
  token: string;
  channel: 'email' | 'whatsapp';
  initiallyOptedOut: boolean;
}) {
  const [optOutState, optOutAction, optOutPending] = useActionState<
    UnsubscribeResult | null,
    FormData
  >(confirmUnsubscribeAction, null);
  const [optInState, optInAction, optInPending] = useActionState<
    UnsubscribeResult | null,
    FormData
  >(resubscribeAction, null);

  const optedOut =
    initiallyOptedOut ||
    (optOutState?.ok && optOutState.action === 'opted_out');
  const reactivated = optInState?.ok && optInState.action === 'opted_in';
  const showAsOptedOut = optedOut && !reactivated;

  if (showAsOptedOut) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green-600 text-xs font-bold text-white"
            aria-hidden="true"
          >
            ✓
          </span>
          <p>
            You won&apos;t receive {channel} messages from us anymore. Done.
          </p>
        </div>
        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer rounded px-1 py-0.5 hover:text-zinc-700 dark:hover:text-zinc-300">
            Changed your mind? Resubscribe →
          </summary>
          <form action={optInAction} className="mt-3">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              disabled={optInPending}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {optInPending ? 'Working…' : `Resubscribe to ${channel}`}
            </button>
            {optInState && !optInState.ok && (
              <p className="mt-2 text-sm text-red-700 dark:text-red-400">
                {optInState.error}
              </p>
            )}
          </form>
        </details>
      </div>
    );
  }

  return (
    <form action={optOutAction}>
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={optOutPending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        {optOutPending ? 'Working…' : `Unsubscribe from ${channel}`}
      </button>
      {optOutState && !optOutState.ok && (
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">
          {optOutState.error}
        </p>
      )}
    </form>
  );
}
