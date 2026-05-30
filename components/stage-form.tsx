'use client';

import { useActionState } from 'react';
import {
  createStageAction,
  updateStageAction,
  type StageActionResult,
} from '@/modules/stages/actions';
import { STAGE_COLORS, type Stage } from '@/modules/stages/types';
import { StageColorSwatch } from './stage-badge';

type Mode = { mode: 'create' } | { mode: 'edit'; stage: Stage };

export function StageForm(props: Mode) {
  const action =
    props.mode === 'create' ? createStageAction : updateStageAction;
  const initial = props.mode === 'edit' ? props.stage : null;
  const [state, formAction, pending] = useActionState<
    StageActionResult | null,
    FormData
  >(action, null);

  const fieldCls =
    'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950';

  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <Label>Name</Label>
          <input
            type="text"
            name="name"
            required
            defaultValue={initial?.name ?? ''}
            placeholder="Registered"
            className={fieldCls}
          />
        </label>
        <label className="text-sm">
          <Label>Slug</Label>
          <input
            type="text"
            name="slug"
            defaultValue={initial?.slug ?? ''}
            placeholder="auto-generated from name if blank"
            className={fieldCls + ' font-mono'}
            pattern="[a-z0-9_]+"
            title="lowercase letters, digits, and underscores only"
          />
        </label>
      </div>

      <label className="block text-sm">
        <Label>Description (optional)</Label>
        <input
          type="text"
          name="description"
          defaultValue={initial?.description ?? ''}
          placeholder="What this stage means in practice"
          className={fieldCls}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <Label>Sort order</Label>
          <input
            type="number"
            name="ordinal"
            defaultValue={initial?.ordinal ?? 0}
            className={fieldCls + ' tabular-nums'}
          />
        </label>
        <label className="text-sm">
          <Label>Color</Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {STAGE_COLORS.map((c) => (
              <label
                key={c}
                className="flex cursor-pointer items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs hover:border-zinc-400 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:border-zinc-700 dark:has-[:checked]:bg-indigo-950/40"
              >
                <input
                  type="radio"
                  name="color"
                  value={c}
                  defaultChecked={(initial?.color ?? 'zinc') === c}
                  className="sr-only"
                />
                <StageColorSwatch color={c} />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </label>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_initial"
            value="1"
            defaultChecked={!!initial?.is_initial}
          />
          <span>
            <span className="font-medium">Initial stage</span>
            <span className="block text-xs text-zinc-500">
              New participants start here. Only one per event.
            </span>
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_terminal"
            value="1"
            defaultChecked={!!initial?.is_terminal}
          />
          <span>
            <span className="font-medium">Terminal</span>
            <span className="block text-xs text-zinc-500">
              No further outreach expected.
            </span>
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Saving…' : props.mode === 'create' ? 'Create stage' : 'Save changes'}
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
