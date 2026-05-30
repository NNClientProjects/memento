'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  deleteTemplateAction,
  type TemplateActionResult,
} from '@/modules/communications/actions';

export function DeleteTemplateButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    TemplateActionResult | null,
    FormData
  >(deleteTemplateAction, null);

  useEffect(() => {
    if (state?.ok) router.push('/templates');
  }, [state, router]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm('Delete this template? Cannot be undone.')) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={templateId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        {pending ? 'Deleting…' : 'Delete'}
      </button>
      {state && !state.ok && (
        <p className="mt-1 text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
