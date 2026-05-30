import Link from 'next/link';
import { authConfigured } from '@/lib/auth-cookie';
import { LogoutButton } from './logout-button';

export function Nav() {
  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
        <Link
          href="/participants"
          className="text-base font-semibold tracking-tight"
        >
          Memento
        </Link>
        <div className="flex items-center gap-5 text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="/participants"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Participants
          </Link>
          <Link
            href="/templates"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Templates
          </Link>
          <Link
            href="/communications"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Sent
          </Link>
          <Link
            href="/inbox"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Inbox
          </Link>
          <Link
            href="/setup"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Setup
          </Link>
        </div>
        {authConfigured() && (
          <div className="ml-auto">
            <LogoutButton />
          </div>
        )}
      </div>
    </nav>
  );
}
