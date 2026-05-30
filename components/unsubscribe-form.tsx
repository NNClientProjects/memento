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
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300">
          ✓ You won&apos;t receive {channel} messages from us anymore.
        </div>
        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer">
            Changed your mind? Resubscribe.
          </summary>
          <form action={optInAction} className="mt-3">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              disabled={optInPending}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              {optInPending ? 'Working…' : 'Resubscribe to ' + channel}
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
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {optOutPending ? 'Working…' : 'Unsubscribe from ' + channel}
      </button>
      {optOutState && !optOutState.ok && (
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">
          {optOutState.error}
        </p>
      )}
    </form>
  );
}
