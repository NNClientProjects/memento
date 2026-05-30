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

  if (!authConfigured()) {
    return (
      <main className="mx-auto max-w-sm px-6 py-20">
        <h1 className="text-2xl font-semibold tracking-tight">Memento</h1>
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
          Auth is not configured. Set{' '}
          <code>ADMIN_PASSWORD</code> and <code>AUTH_COOKIE_SECRET</code> in the
          environment, then redeploy/restart. While unset, all pages are
          accessible without a password.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-20">
      <h1 className="text-2xl font-semibold tracking-tight">Memento</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Sign in to continue.
      </p>
      <div className="mt-6">
        <LoginForm next={next} />
      </div>
    </main>
  );
}
