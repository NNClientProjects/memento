'use client';

import { useActionState } from 'react';
import {
  runAutomationsAction,
  type RunResult,
} from '@/modules/rules/actions';

export function RunAutomationsButton() {
  const [state, formAction, pending] = useActionState<RunResult | null, FormData>(
    runAutomationsAction,
    null
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? 'Running…' : 'Run automations now'}
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
          {state.ok ? (
            <Summary state={state} />
          ) : (
            state.error
          )}
        </div>
      )}
    </div>
  );
}

function Summary({ state }: { state: Extract<RunResult, { ok: true }> }) {
  const s = state.summary;
  const skippedTotal = Object.values(s.skipped).reduce((a, b) => a + b, 0);
  const parts: string[] = [];
  parts.push(`${s.rulesEnabled} rule${s.rulesEnabled === 1 ? '' : 's'}`);
  parts.push(`${s.candidatesConsidered} candidate${s.candidatesConsidered === 1 ? '' : 's'}`);
  parts.push(`${s.fired} fired`);
  if (skippedTotal > 0) parts.push(`${skippedTotal} skipped`);
  if (s.failed > 0) parts.push(`${s.failed} failed`);

  return (
    <div>
      <p className="font-medium">{parts.join(' · ')}</p>
      {skippedTotal > 0 && (
        <p className="mt-1 text-[11px]">
          Skipped reasons:{' '}
          {Object.entries(s.skipped)
            .map(([k, v]) => `${k} ×${v}`)
            .join(', ')}
        </p>
      )}
    </div>
  );
}
