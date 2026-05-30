'use client';

import { useMemo, useState } from 'react';
import {
  render,
  unknownFields,
  extractMergeFields,
  type MergeContext,
} from '@/modules/communications/merge-fields';
import type { Template } from '@/modules/communications/types';

function toWaLink(phoneE164: string | null, message: string): string | null {
  if (!phoneE164) return null;
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function WhatsAppPanel({
  participantId,
  participantPhone,
  templates,
  mergeContext,
  optedOut,
}: {
  participantId: string;
  participantPhone: string | null;
  templates: Template[];
  mergeContext: MergeContext;
  optedOut: boolean;
}) {
  const [templateId, setTemplateId] = useState<string>('');
  const [logState, setLogState] = useState<
    'idle' | 'opening' | 'logged' | 'log_failed'
  >('idle');

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId]
  );

  const rendered = useMemo(() => {
    if (!template) return null;
    const body = render(template.body, mergeContext);
    const used = extractMergeFields(template.body);
    return { body, unknown: unknownFields(used) };
  }, [template, mergeContext]);

  const link = useMemo(
    () => (rendered ? toWaLink(participantPhone, rendered.body) : null),
    [rendered, participantPhone]
  );

  if (!participantPhone) {
    return (
      <p className="px-4 py-3 text-sm text-zinc-500">
        No phone number on file — cannot open WhatsApp. Add a WhatsApp Number
        in the master Sheet and re-sync.
      </p>
    );
  }

  if (optedOut) {
    return (
      <p className="px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
        This participant has opted out of WhatsApp. Launch link blocked.
        Resubscribe from the Opt-out card if they ask to be added back.
      </p>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-zinc-500">
        No WhatsApp templates yet.{' '}
        <a href="/templates" className="underline">
          Create one
        </a>{' '}
        first.
      </p>
    );
  }

  const handleOpen = () => {
    if (!link || !template) return;
    setLogState('opening');
    window.open(link, '_blank', 'noopener,noreferrer');
    fetch('/api/comms/whatsapp-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId,
        templateId: template.id,
        body: rendered?.body ?? '',
        subject: template.subject ?? null,
      }),
    })
      .then((r) => (r.ok ? setLogState('logged') : setLogState('log_failed')))
      .catch(() => setLogState('log_failed'));
  };

  return (
    <div className="space-y-3 px-4 py-3">
      <label className="block text-sm">
        <span className="block text-xs uppercase tracking-wider text-zinc-500">
          Template
        </span>
        <select
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value);
            setLogState('idle');
          }}
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

      {rendered && (
        <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Preview
          </p>
          <pre className="whitespace-pre-wrap rounded bg-white p-2 text-xs dark:bg-zinc-950">
            {rendered.body}
          </pre>
          {rendered.unknown.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Unknown merge fields: {rendered.unknown.join(', ')} (rendered as
              empty)
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpen}
          disabled={!template || !link}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Open in WhatsApp →
        </button>
        {logState === 'logged' && (
          <span className="text-xs text-green-700 dark:text-green-400">
            Logged as queued in Communications.
          </span>
        )}
        {logState === 'log_failed' && (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            Opened in WhatsApp, but logging failed.
          </span>
        )}
      </div>

      <p className="text-xs text-zinc-500">
        Opens WhatsApp Web/app with the message pre-filled. You still have to
        press Send there. We log the click as <code>queued</code> — delivery
        status isn&apos;t observable for manual launch links.
      </p>
    </div>
  );
}
