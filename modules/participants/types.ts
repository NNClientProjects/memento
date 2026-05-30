import type { PaymentStatus, CommChannel } from '@/lib/lifecycle';
import type { Stage } from '@/modules/stages/types';

export type Participant = {
  id: string;
  event_id: string;
  full_name: string;
  email: string | null;
  phone_e164: string | null;
  alt_phone: string | null;
  current_city: string | null;
  current_country: string | null;
  family_group_id: string | null;
  lifecycle_stage_id: string;
  entered_current_stage_at: string;
  payment_status: PaymentStatus;
  assigned_organiser_id: string | null;
  last_contacted_at: string | null;
  last_contacted_channel: CommChannel | null;
  self_reported_status: string | null;
  form_submitted_at: string | null;
  sheet_row_number: number | null;
  source: string | null;
  added_by: string | null;
  notes: string | null;
  custom: Record<string, unknown>;
  sheet_tracking_snapshot: Record<string, string> | null;
  sheet_tracking_synced_at: string | null;
  sheet_edit_detected_at: string | null;
  whatsapp_claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

// Convenience: a participant joined with its current stage row.
export type ParticipantWithStage = Participant & {
  stage: Stage | null;
};

export type ReunionAttendee = {
  participant_id: string;
  batch: number | null;
  dorm: string | null;
  dorm_number: string | null;
  section: string | null;
  spouse_name: string | null;
  spouse_dorm: string | null;
  spouse_dorm_number: string | null;
  meal_pref: string | null;
  needs_room: boolean;
  room_count: number;
  suite_upgrade: boolean;
  extend_stay: boolean;
  attendee_composition: string | null;
  kids: Record<string, number>;
  extra_adults: Array<{ name?: string; role?: string }>;
  freeform_notes: string | null;
  advance_paid: boolean;
};
