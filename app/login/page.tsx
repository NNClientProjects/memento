import { LoginForm } from '@/components/login-form';
import { authConfigured } from '@/lib/auth-cookie';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : '/';

  return (
    <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-base font-bold text-white shadow-md shadow-indigo-600/20"
            aria-hidden="true"
          >
            M
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Memento</h1>
            <p className="text-xs text-zinc-500">Event organising · Reunion 2026</p>
          </div>
        </div>

        {!authConfigured() ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <p className="font-medium">Auth is not configured</p>
            <p className="mt-1 text-xs">
              Set <code>ADMIN_PASSWORD</code> and <code>AUTH_COOKIE_SECRET</code>{' '}
              in the environment, then redeploy. While unset, every page is
              accessible without sign-in.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              Sign in to continue.
            </p>
            <LoginForm next={next} />
          </div>
        )}
      </div>
    </main>
  );
}
