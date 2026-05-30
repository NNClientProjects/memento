// Lifecycle stages are now stored in the lifecycle_stages table (per-event,
// configurable). Code that needs the list at runtime queries the DB via
// modules/stages/repository.ts. Payment status and comm channels stay
// hardcoded — they're tightly coupled to integration code and don't change
// across events.

export const PAYMENT_STATUSES = [
  'not_due',
  'advance_pending',
  'advance_paid',
  'fully_paid',
  'refunded',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  not_due: 'Not due',
  advance_pending: 'Advance pending',
  advance_paid: 'Advance paid',
  fully_paid: 'Fully paid',
  refunded: 'Refunded',
};

export const COMM_CHANNELS = ['email', 'whatsapp', 'phone', 'in_person'] as const;
export type CommChannel = (typeof COMM_CHANNELS)[number];
