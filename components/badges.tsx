import {
  LIFECYCLE_LABELS,
  PAYMENT_LABELS,
  type LifecycleStage,
  type PaymentStatus,
} from '@/lib/lifecycle';

const LIFECYCLE_COLORS: Record<LifecycleStage, string> = {
  not_contacted: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  contacted_no_response: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  responded_not_interested: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  responded_unsure: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  responded_interested_not_registered: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  registered: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  dropped: 'bg-zinc-200 text-zinc-500 line-through dark:bg-zinc-900',
  checked_in: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  not_due: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  advance_pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  advance_paid: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  fully_paid: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  refunded: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-900',
};

export function LifecycleBadge({ stage }: { stage: LifecycleStage }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_COLORS[stage]}`}
    >
      {LIFECYCLE_LABELS[stage]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_COLORS[status]}`}
    >
      {PAYMENT_LABELS[status]}
    </span>
  );
}
