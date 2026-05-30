'use client';

import { useActionState } from 'react';
import {
  createTemplateAction,
  updateTemplateAction,
  type TemplateActionResult,
} from '@/modules/communications/actions';
import { KNOWN_MERGE_FIELDS } from '@/modules/communications/merge-fields';
import type { Template } from '@/modules/communications/types';

type Mode =
  | { mode: 'create' }
  | { mode: 'edit'; template: Template };

export function TemplateForm(props: Mode) {
  const action =
    props.mode === 'create' ? createTemplateAction : updateTemplateAction;
  const initial = props.mode === 'edit' ? props.template : null;

  const [state, formAction, pending] = useActionState<
    TemplateActionResult | null,
    FormData
  >(action, null);

  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-zinc-500">
            Name
          </span>
          <input
            type="text"
            name="name"
            required
            defaultValue={initial?.name ?? ''}
            placeholder="Initial outreach"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-zinc-500">
            Channel
          </span>
          {props.mode === 'create' ? (
            <select
              name="channel"
              defaultValue="email"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp (manual launch link)</option>
            </select>
          ) : (
            <input
              type="text"
              value={initial!.channel}
              readOnly
              className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            />
          )}
        </label>
      </div>

      <label className="block text-sm">
        <span className="block text-xs uppercase tracking-wider text-zinc-500">
          Subject
        </span>
        <input
          type="text"
          name="subject"
          defaultValue={initial?.subject ?? ''}
          placeholder="Reunion 2026 — quick update"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="block text-sm">
        <span className="block text-xs uppercase tracking-wider text-zinc-500">
          Body
        </span>
        <textarea
          name="body"
          required
          rows={12}
          defaultValue={initial?.body ?? ''}
          placeholder={
            'Hi {{first_name}},\n\nWe\'re excited about {{event_name}}.\nDorm {{dorm}}, see you soon!\n\n— Organisers'
          }
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="block text-sm">
        <span className="block text-xs uppercase tracking-wider text-zinc-500">
          Status
        </span>
        <select
          name="status"
          defaultValue={initial?.status ?? 'draft'}
          className="mt-1 w-48 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="draft">Draft</option>
          <option value="approved">Approved (ready to send)</option>
          <option value="pending_approval">Pending approval</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>

      <div className="rounded-md bg-zinc-50 p-3 text-xs dark:bg-zinc-900/50">
        <p className="mb-2 font-medium text-zinc-700 dark:text-zinc-300">
          Available merge fields
        </p>
        <div className="flex flex-wrap gap-2 font-mono">
          {KNOWN_MERGE_FIELDS.map((f) => (
            <code
              key={f}
              className="rounded bg-zinc-200 px-1.5 py-0.5 dark:bg-zinc-800"
            >
              {`{{${f}}}`}
            </code>
          ))}
        </div>
        {initial && initial.merge_fields.length > 0 && (
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Detected in this template:{' '}
            <span className="font-mono">{initial.merge_fields.join(', ')}</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending
            ? 'Saving…'
            : props.mode === 'create'
              ? 'Create template'
              : 'Save changes'}
        </button>
      </div>

      {state && (
        <p
          className={`text-sm ${
            state.ok
              ? 'text-green-700 dark:text-green-400'
              : 'text-red-700 dark:text-red-400'
          }`}
        >
          {state.ok ? state.message : state.error}
        </p>
      )}
    </form>
  );
}
