'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteRuleAction,
  type RuleActionResult,
} from '@/modules/rules/actions';

export function DeleteRuleButton({ ruleId }: { ruleId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    RuleActionResult | null,
    FormData
  >(deleteRuleAction, null);

  useEffect(() => {
    if (state?.ok) router.push('/automations');
  }, [state, router]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm('Delete this automation? Cannot be undone.')) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={ruleId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-950"
      >
        {pending ? 'Deleting…' : 'Delete automation'}
      </button>
      {state && !state.ok && (
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
