'use client';

import { useActionState } from 'react';
import { loginAction, type LoginResult } from '@/app/login/actions';

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(
    loginAction,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Password
        </span>
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      {state && !state.ok && (
        <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
