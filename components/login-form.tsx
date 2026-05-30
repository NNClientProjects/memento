'use client';

import { useActionState } from 'react';
import { loginAction, type LoginResult } from '@/app/login/actions';

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(
    loginAction,
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-zinc-500">
          Password
        </span>
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      {state && !state.ok && (
        <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
