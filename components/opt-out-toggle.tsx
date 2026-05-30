'use client';

import { useActionState } from 'react';
import {
  toggleOptOutAction,
  type OptOutToggleResult,
} from '@/modules/communications/opt-out-actions';

export function OptOutToggle({
  participantId,
  channel,
  optedOut,
  optedOutAt,
}: {
  participantId: string;
  channel: 'email' | 'whatsapp';
  optedOut: boolean;
  optedOutAt: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    OptOutToggleResult | null,
    FormData
  >(toggleOptOutAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3 text-sm">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="channel" value={channel} />
      <input
        type="hidden"
        name="direction"
        value={optedOut ? 'opt_in' : 'opt_out'}
      />
      <span className="font-medium capitalize">{channel}</span>
      <span
        className={
          optedOut
            ? 'text-red-700 dark:text-red-400'
            : 'text-zinc-600 dark:text-zinc-400'
        }
      >
        {optedOut
          ? `opted out${optedOutAt ? ` on ${new Date(optedOutAt).toLocaleDateString()}` : ''}`
          : 'subscribed'}
      </span>
      <button
        type="submit"
        disabled={pending}
        className="ml-auto rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      >
        {pending ? '…' : optedOut ? 'Resubscribe' : 'Opt out'}
      </button>
      {state && !state.ok && (
        <p className="w-full text-xs text-red-700 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
