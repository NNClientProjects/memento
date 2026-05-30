'use client';

import { useActionState } from 'react';
import {
  sendEmailAction,
  type SendEmailActionResult,
} from '@/modules/communications/actions';
import type { Template } from '@/modules/communications/types';

export function SendEmailPanel({
  participantId,
  participantEmail,
  templates,
  optedOut,
}: {
  participantId: string;
  participantEmail: string | null;
  templates: Template[];
  optedOut: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    SendEmailActionResult | null,
    FormData
  >(sendEmailAction, null);

  if (!participantEmail) {
    return (
      <p className="px-4 py-3 text-sm text-zinc-500">
        No email on file — cannot send. Add an email in the master Sheet and
        re-sync.
      </p>
    );
  }

  if (optedOut) {
    return (
      <p className="px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
        This participant has opted out of email. Sends are blocked. Resubscribe
        from the Opt-out card if they ask to be added back.
      </p>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-zinc-500">
        No email templates yet.{' '}
        <a href="/templates" className="underline">
          Create one
        </a>{' '}
        first.
      </p>
    );
  }

  const approvedTemplates = templates.filter((t) => t.status === 'approved');

  return (
    <div className="px-4 py-3">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="recipientIds" value={participantId} />
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
              {pending ? 'Working…' : 'Preview'}
            </button>
            <button
              type="submit"
              name="dryRun"
              value="0"
              disabled={pending || approvedTemplates.length === 0}
              className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              title={
                approvedTemplates.length === 0
                  ? 'No approved templates yet'
                  : `Send to ${participantEmail}`
              }
            >
              Send
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Preview is a dry-run (no email goes out). Sending requires the
          template to be marked &ldquo;approved&rdquo;.
        </p>
      </form>

      {state && <SendResultView state={state} />}
    </div>
  );
}

function SendResultView({ state }: { state: SendEmailActionResult }) {
  if (!state.ok) {
    return (
      <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
        {state.error}
      </div>
    );
  }

  if (state.dryRun) {
    const rcpt = state.recipients[0];
    if (!rcpt || rcpt.status === 'skipped') {
      return (
        <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Skipped: {rcpt?.error ?? 'unknown'}
        </div>
      );
    }
    return (
      <div className="mt-3 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/30">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Preview (dry run)
        </p>
        <div>
          <span className="text-xs text-zinc-500">To: </span>
          <span className="font-mono text-xs">{rcpt.to}</span>
        </div>
        <div>
          <span className="text-xs text-zinc-500">Subject: </span>
          <span className="font-medium">{rcpt.subject}</span>
        </div>
        <div>
          <span className="text-xs text-zinc-500">Body:</span>
          <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-xs dark:bg-zinc-950">
            {rcpt.body}
          </pre>
        </div>
        {state.unknownFields.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Unknown merge fields: {state.unknownFields.join(', ')} (rendered as
            empty)
          </p>
        )}
      </div>
    );
  }

  const rcpt = state.recipients[0];
  if (!rcpt) {
    return (
      <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-900/30">
        No-op.
      </div>
    );
  }
  if (rcpt.status === 'sent') {
    return (
      <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
        Sent to {rcpt.to}. Gmail message id:{' '}
        <span className="font-mono text-xs">{rcpt.externalId}</span>
      </div>
    );
  }
  if (rcpt.status === 'failed') {
    return (
      <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
        Failed: {rcpt.error}
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
      Skipped: {rcpt.error}
    </div>
  );
}
