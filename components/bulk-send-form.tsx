'use client';

import { useActionState } from 'react';
import {
  sendEmailAction,
  type SendEmailActionResult,
} from '@/modules/communications/actions';
import type { Template } from '@/modules/communications/types';

export function BulkSendForm({
  recipientIds,
  templates,
  tooMany,
}: {
  recipientIds: string[];
  templates: Template[];
  tooMany: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    SendEmailActionResult | null,
    FormData
  >(sendEmailAction, null);

  if (templates.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No email templates yet.{' '}
        <a href="/templates" className="underline">
          Create one
        </a>{' '}
        first.
      </p>
    );
  }

  return (
    <div>
      <form action={formAction} className="space-y-3">
        <input
          type="hidden"
          name="recipientIds"
          value={recipientIds.join(',')}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="block text-xs uppercase tracking-wider text-zinc-500">
              Template
            </span>
            <select
              name="templateId"
              required
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">Pick one…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.status !== 'approved' ? ` (${t.status})` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 text-sm">
            <button
              type="submit"
              name="dryRun"
              value="1"
              disabled={pending}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              {pending ? 'Working…' : 'Preview first 3'}
            </button>
            <button
              type="submit"
              name="dryRun"
              value="0"
              disabled={pending || tooMany}
              className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              title={tooMany ? 'Over the per-send cap' : `Send to ${recipientIds.length}`}
            >
              Send to {recipientIds.length}
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Preview is a dry-run (renders first 3 recipients, no email goes out).
          Sending requires the template to be marked &ldquo;approved&rdquo;.
          Rate-limited to ~5 sends/sec.
        </p>
      </form>

      {state && <BulkSendResultView state={state} />}
    </div>
  );
}

function BulkSendResultView({ state }: { state: SendEmailActionResult }) {
  if (!state.ok) {
    return (
      <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
        {state.error}
      </div>
    );
  }

  if (state.dryRun) {
    const preview = state.recipients
      .filter((r) => r.status === 'previewed')
      .slice(0, 3);

    return (
      <div className="mt-4 space-y-3">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Dry run: {state.attempted} would send, {state.skipped} skipped.
          {state.unknownFields.length > 0 && (
            <span className="ml-2 text-amber-700 dark:text-amber-400">
              Unknown merge fields: {state.unknownFields.join(', ')}
            </span>
          )}
        </p>
        {preview.map((r, i) => (
          <div
            key={r.participantId}
            className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/30"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Preview {i + 1} → {r.to}
            </p>
            <p className="mt-1">
              <span className="text-xs text-zinc-500">Subject: </span>
              <span className="font-medium">{r.subject}</span>
            </p>
            <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-xs dark:bg-zinc-950">
              {r.body}
            </pre>
          </div>
        ))}
        {state.recipients.length > preview.length && (
          <p className="text-xs text-zinc-500">
            … +{state.recipients.length - preview.length} more recipients
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <div
        className={`rounded-md p-3 text-sm ${
          state.failed > 0
            ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
            : 'bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-300'
        }`}
      >
        <p className="font-medium">
          Sent {state.sent} · Failed {state.failed} · Skipped {state.skipped}
        </p>
      </div>
      {state.recipients.some((r) => r.status === 'failed' || r.status === 'skipped') && (
        <details>
          <summary className="cursor-pointer text-xs text-zinc-600">
            Show per-recipient outcomes
          </summary>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
            {state.recipients.map((r) => (
              <li
                key={r.participantId}
                className="flex items-baseline justify-between gap-2 px-3 py-1 text-xs"
              >
                <span className="font-mono">{r.to ?? r.participantId}</span>
                <span
                  className={
                    r.status === 'sent'
                      ? 'text-green-700'
                      : r.status === 'failed'
                        ? 'text-red-700'
                        : 'text-zinc-500'
                  }
                >
                  {r.status}
                  {r.error && ` — ${r.error}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
