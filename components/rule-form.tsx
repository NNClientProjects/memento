'use client';

import { useActionState, useState } from 'react';
import {
  createRuleAction,
  updateRuleAction,
  type RuleActionResult,
} from '@/modules/rules/actions';
import type { Rule } from '@/modules/rules/types';
import type { Stage } from '@/modules/stages/types';
import type { Template } from '@/modules/communications/types';

type RuleFormProps = {
  stages: Stage[];
  emailTemplates: Template[];
  whatsappTemplates: Template[];
} & ({ mode: 'create' } | { mode: 'edit'; rule: Rule });

export function RuleForm(props: RuleFormProps) {
  const { stages, emailTemplates, whatsappTemplates } = props;
  const isEdit = props.mode === 'edit';
  const initial: Rule | null = isEdit ? props.rule : null;
  const action = isEdit ? updateRuleAction : createRuleAction;
  const [state, formAction, pending] = useActionState<
    RuleActionResult | null,
    FormData
  >(action, null);

  const [actionType, setActionType] = useState<'send_template' | 'change_stage'>(
    initial?.action_type ?? 'send_template'
  );

  const allApprovedTemplates = [...emailTemplates, ...whatsappTemplates].filter(
    (t) => t.status === 'approved'
  );

  const fieldCls =
    'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950';

  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <Label>Name</Label>
          <input
            type="text"
            name="name"
            required
            defaultValue={initial?.name ?? ''}
            placeholder="Remind contacted-no-response after 7 days"
            className={fieldCls}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <Label>Description (optional)</Label>
          <input
            type="text"
            name="description"
            defaultValue={initial?.description ?? ''}
            placeholder="What this rule does and why"
            className={fieldCls}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          value="1"
          defaultChecked={initial?.enabled ?? true}
        />
        <span>
          <span className="font-medium">Enabled</span>
          <span className="ml-1 text-xs text-zinc-500">
            disabled rules are not evaluated when the engine runs
          </span>
        </span>
      </label>

      <Fieldset title="Trigger">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <Label>When in stage</Label>
            <select
              name="trigger_stage_id"
              required
              defaultValue={initial?.trigger_stage_id ?? ''}
              className={fieldCls}
            >
              <option value="">Pick a stage…</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <Label>For at least N days</Label>
            <input
              type="number"
              name="trigger_stale_days"
              required
              min={0}
              max={365}
              defaultValue={initial?.trigger_stale_days ?? 7}
              className={fieldCls + ' tabular-nums'}
            />
          </label>
        </div>
      </Fieldset>

      <Fieldset title="Action">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <ActionTypeRadio
              value="send_template"
              checked={actionType === 'send_template'}
              onChange={() => setActionType('send_template')}
              label="Send a template"
            />
            <ActionTypeRadio
              value="change_stage"
              checked={actionType === 'change_stage'}
              onChange={() => setActionType('change_stage')}
              label="Move to another stage"
            />
          </div>

          {actionType === 'send_template' ? (
            <label className="block text-sm">
              <Label>Template</Label>
              <select
                name="action_template_id"
                defaultValue={initial?.action_template_id ?? ''}
                className={fieldCls}
              >
                <option value="">Pick an approved template…</option>
                {allApprovedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.channel} · {t.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">
                Only approved templates appear here. Mark a template as
                approved on its edit page first.
              </p>
            </label>
          ) : (
            <label className="block text-sm">
              <Label>Move them to</Label>
              <select
                name="action_target_stage_id"
                defaultValue={initial?.action_target_stage_id ?? ''}
                className={fieldCls}
              >
                <option value="">Pick a target stage…</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </Fieldset>

      <label className="block text-sm">
        <Label>Cooldown (hours)</Label>
        <input
          type="number"
          name="cooldown_hours"
          min={0}
          max={8760}
          defaultValue={initial?.cooldown_hours ?? 24}
          className={fieldCls + ' w-32 tabular-nums'}
        />
        <p className="mt-1 text-xs text-zinc-500">
          Don&apos;t fire on the same participant more often than this. 24 hours
          is a sensible default for daily reminders.
        </p>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create automation'}
      </button>

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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
      {children}
    </span>
  );
}

function Fieldset({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
      <legend className="px-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function ActionTypeRadio({
  value,
  checked,
  onChange,
  label,
}: {
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        checked
          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300'
          : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300'
      }`}
    >
      <input
        type="radio"
        name="action_type"
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}
