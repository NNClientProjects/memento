import { getSupabaseAdmin } from '@/lib/supabase';
import type { LifecycleStage, PaymentStatus } from '@/lib/lifecycle';
import type { Participant, ReunionAttendee } from './types';

export async function listParticipants(eventId: string): Promise<Participant[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('participants')
    .select('*')
    .eq('event_id', eventId)
    .order('full_name');
  if (error) throw error;
  return (data ?? []) as Participant[];
}

export async function getParticipantByEmail(
  eventId: string,
  email: string
): Promise<Participant | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('participants')
    .select('*')
    .eq('event_id', eventId)
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return (data as Participant | null) ?? null;
}

export type ParticipantWithReunion = Participant & {
  reunion: ReunionAttendee | null;
};

export type ParticipantFilters = {
  stages?: LifecycleStage[];
  payments?: PaymentStatus[];
  dorm?: string;
  section?: string;
  familyGroupId?: string;
  q?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  sort?: 'name' | 'last_contacted';
  limit?: number;
};

export async function listParticipantsFiltered(
  eventId: string,
  filters: ParticipantFilters
): Promise<ParticipantWithReunion[]> {
  const db = getSupabaseAdmin();
  let q = db
    .from('participants')
    .select('*, reunion:reunion_attendees(*)')
    .eq('event_id', eventId);

  if (filters.stages?.length) q = q.in('lifecycle_stage', filters.stages);
  if (filters.payments?.length) q = q.in('payment_status', filters.payments);
  if (filters.familyGroupId) q = q.eq('family_group_id', filters.familyGroupId);
  if (filters.hasEmail) q = q.not('email', 'is', null);
  if (filters.hasPhone) q = q.not('phone_e164', 'is', null);
  if (filters.q) {
    const term = `%${filters.q}%`;
    q = q.or(`full_name.ilike.${term},email.ilike.${term}`);
  }

  if (filters.sort === 'last_contacted') {
    q = q.order('last_contacted_at', { ascending: false, nullsFirst: false });
  } else {
    q = q.order('full_name', { ascending: true });
  }

  q = q.limit(filters.limit ?? 500);

  const { data, error } = await q;
  if (error) throw error;

  // Supabase returns reunion as an array (it doesn't know it's 1:1); normalize.
  const rows = (data ?? []) as Array<
    Participant & { reunion: ReunionAttendee[] | ReunionAttendee | null }
  >;
  let normalized = rows.map((r) => ({
    ...r,
    reunion: Array.isArray(r.reunion) ? (r.reunion[0] ?? null) : r.reunion,
  })) as ParticipantWithReunion[];

  // Dorm/section filters apply post-fetch (live in joined reunion_attendees table).
  if (filters.dorm) {
    const d = filters.dorm.toLowerCase();
    normalized = normalized.filter(
      (r) => r.reunion?.dorm?.toLowerCase() === d
    );
  }
  if (filters.section) {
    const s = filters.section.toLowerCase();
    normalized = normalized.filter(
      (r) => r.reunion?.section?.toLowerCase() === s
    );
  }

  return normalized;
}

export async function getParticipantById(
  eventId: string,
  id: string
): Promise<ParticipantWithReunion | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('participants')
    .select('*, reunion:reunion_attendees(*)')
    .eq('event_id', eventId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Participant & {
    reunion: ReunionAttendee[] | ReunionAttendee | null;
  };
  return {
    ...row,
    reunion: Array.isArray(row.reunion) ? (row.reunion[0] ?? null) : row.reunion,
  } as ParticipantWithReunion;
}

export type SheetRowInput = {
  full_name: string;
  email: string | null;
  phone_e164: string | null;
  alt_phone?: string | null;
  current_city?: string | null;
  current_country?: string | null;
  family_group_id?: string | null;
  sheet_row_number: number;
  source?: string | null;
};

export type UpsertResult = {
  id: string;
  isNew: boolean;
  matchedBy: 'email' | 'phone' | 'sheet_row' | null;
};

export async function upsertParticipantFromSheet(
  eventId: string,
  row: SheetRowInput
): Promise<UpsertResult> {
  const db = getSupabaseAdmin();

  let existing: { id: string } | null = null;
  let matchedBy: UpsertResult['matchedBy'] = null;

  if (row.email) {
    const { data, error } = await db
      .from('participants')
      .select('id')
      .eq('event_id', eventId)
      .eq('email', row.email)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      existing = data as { id: string };
      matchedBy = 'email';
    }
  }

  if (!existing && row.phone_e164) {
    const { data, error } = await db
      .from('participants')
      .select('id')
      .eq('event_id', eventId)
      .eq('phone_e164', row.phone_e164)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      existing = data as { id: string };
      matchedBy = 'phone';
    }
  }

  if (!existing) {
    const { data, error } = await db
      .from('participants')
      .select('id')
      .eq('event_id', eventId)
      .eq('sheet_row_number', row.sheet_row_number)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      existing = data as { id: string };
      matchedBy = 'sheet_row';
    }
  }

  if (existing) {
    const { error } = await db
      .from('participants')
      .update({
        full_name: row.full_name,
        email: row.email,
        phone_e164: row.phone_e164,
        alt_phone: row.alt_phone ?? null,
        current_city: row.current_city ?? null,
        current_country: row.current_country ?? null,
        family_group_id: row.family_group_id ?? null,
        sheet_row_number: row.sheet_row_number,
        source: row.source ?? null,
      })
      .eq('id', existing.id);
    if (error) throw error;
    return { id: existing.id, isNew: false, matchedBy };
  }

  const { data, error } = await db
    .from('participants')
    .insert({
      event_id: eventId,
      full_name: row.full_name,
      email: row.email,
      phone_e164: row.phone_e164,
      alt_phone: row.alt_phone ?? null,
      current_city: row.current_city ?? null,
      current_country: row.current_country ?? null,
      family_group_id: row.family_group_id ?? null,
      sheet_row_number: row.sheet_row_number,
      source: row.source ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id as string, isNew: true, matchedBy: null };
}

export type ReunionAttendeeInput = {
  batch?: number | null;
  dorm?: string | null;
  dorm_number?: string | null;
  section?: string | null;
  spouse_name?: string | null;
  spouse_dorm?: string | null;
  spouse_dorm_number?: string | null;
};

export async function upsertReunionAttendee(
  participantId: string,
  fields: ReunionAttendeeInput
): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from('reunion_attendees').upsert(
    {
      participant_id: participantId,
      batch: fields.batch ?? null,
      dorm: fields.dorm ?? null,
      dorm_number: fields.dorm_number ?? null,
      section: fields.section ?? null,
      spouse_name: fields.spouse_name ?? null,
      spouse_dorm: fields.spouse_dorm ?? null,
      spouse_dorm_number: fields.spouse_dorm_number ?? null,
    },
    { onConflict: 'participant_id' }
  );
  if (error) throw error;
}
