'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@/modules/participants/actions';

type Action = (
  prev: ActionResult | null,
  formData: FormData
) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  className,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );

  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state && (
        <p
          className={`mt-2 text-sm ${
            state.ok
              ? state.severity === 'warning'
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-green-700 dark:text-green-400'
              : 'text-red-700 dark:text-red-400'
          }`}
        >
          {state.ok ? (state.message ?? 'Done.') : state.error}
        </p>
      )}
    </form>
  );
}
