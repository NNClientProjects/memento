import { PAYMENT_LABELS, type PaymentStatus } from '@/lib/lifecycle';

// LifecycleBadge moved to components/stage-badge.tsx (StageBadge) — it now
// takes a stage object loaded from the DB instead of a hardcoded enum.

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  not_due:
    'bg-zinc-100 text-zinc-600 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
  advance_pending:
    'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
  advance_paid:
    'bg-blue-100 text-blue-800 ring-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900',
  fully_paid:
    'bg-green-100 text-green-800 ring-green-300 dark:bg-green-950 dark:text-green-300 dark:ring-green-900',
  refunded:
    'bg-zinc-200 text-zinc-500 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800',
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${PAYMENT_COLORS[status]}`}
    >
      {PAYMENT_LABELS[status]}
    </span>
  );
}
