export const LIFECYCLE_STAGES = [
  'not_contacted',
  'contacted_no_response',
  'responded_not_interested',
  'responded_unsure',
  'responded_interested_not_registered',
  'registered',
  'dropped',
  'checked_in',
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const LIFECYCLE_LABELS: Record<LifecycleStage, string> = {
  not_contacted: 'Not contacted',
  contacted_no_response: 'Contacted, no response',
  responded_not_interested: 'Not interested',
  responded_unsure: 'Unsure',
  responded_interested_not_registered: 'Interested, not registered',
  registered: 'Registered',
  dropped: 'Dropped',
  checked_in: 'Checked in',
};

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
