import Link from 'next/link';
import { authConfigured } from '@/lib/auth-cookie';
import { LogoutButton } from './logout-button';

const navItems = [
  { href: '/participants', label: 'Participants' },
  { href: '/templates', label: 'Templates' },
  { href: '/automations', label: 'Automations' },
  { href: '/communications', label: 'Sent' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/setup', label: 'Setup' },
];

export function Nav() {
  return (
    <nav className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-3 sm:gap-6">
        <Link
          href="/participants"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          <span
            className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-sm"
            aria-hidden="true"
          >
            M
          </span>
          Memento
        </Link>
        <div className="flex items-center gap-1 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
            >
              {item.label}
            </Link>
          ))}
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
