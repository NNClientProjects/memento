import { getSupabaseAdmin } from '@/lib/supabase';
import type { Stage } from './types';

export async function listStages(eventId: string): Promise<Stage[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('lifecycle_stages')
    .select('*')
    .eq('event_id', eventId)
    .order('ordinal');
  if (error) throw error;
  return (data ?? []) as Stage[];
}

export async function getStage(id: string): Promise<Stage | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('lifecycle_stages')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Stage | null) ?? null;
}

export async function getStageBySlug(
  eventId: string,
  slug: string
): Promise<Stage | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('lifecycle_stages')
    .select('*')
    .eq('event_id', eventId)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Stage | null) ?? null;
}

// Look up a stage by name OR slug — used on sheet import where the cell
// may contain either form (organiser-friendly name, or machine slug).
export async function findStageByText(
  eventId: string,
  text: string
): Promise<Stage | null> {
  const normalized = text.trim();
  if (!normalized) return null;
  const stages = await listStages(eventId);
  const slug = stages.find((s) => s.slug === normalized);
  if (slug) return slug;
  const lower = normalized.toLowerCase();
  const byName = stages.find((s) => s.name.toLowerCase() === lower);
  if (byName) return byName;
  return null;
}

export async function getInitialStage(eventId: string): Promise<Stage | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('lifecycle_stages')
    .select('*')
    .eq('event_id', eventId)
    .eq('is_initial', true)
    .maybeSingle();
  if (error) throw error;
  return (data as Stage | null) ?? null;
}

export type StageInput = {
  eventId: string;
  slug: string;
  name: string;
  description?: string | null;
  ordinal?: number;
  color?: string;
  is_initial?: boolean;
  is_terminal?: boolean;
};

export async function createStage(input: StageInput): Promise<Stage> {
  const db = getSupabaseAdmin();
  if (input.is_initial) await clearInitialOnOtherStages(input.eventId);
  const { data, error } = await db
    .from('lifecycle_stages')
    .insert({
      event_id: input.eventId,
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      ordinal: input.ordinal ?? 0,
      color: input.color ?? 'zinc',
      is_initial: input.is_initial ?? false,
      is_terminal: input.is_terminal ?? false,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Stage;
}

export type StageUpdateInput = {
  slug?: string;
  name?: string;
  description?: string | null;
  ordinal?: number;
  color?: string;
  is_initial?: boolean;
  is_terminal?: boolean;
};

async function clearInitialOnOtherStages(
  eventId: string,
  exceptId?: string
): Promise<void> {
  const db = getSupabaseAdmin();
  let q = db
    .from('lifecycle_stages')
    .update({ is_initial: false })
    .eq('event_id', eventId)
    .eq('is_initial', true);
  if (exceptId) q = q.neq('id', exceptId);
  const { error } = await q;
  if (error) throw error;
}

export async function updateStage(
  id: string,
  patch: StageUpdateInput
): Promise<Stage> {
  const db = getSupabaseAdmin();

  if (patch.is_initial) {
    const existing = await getStage(id);
    if (existing) await clearInitialOnOtherStages(existing.event_id, id);
  }

  const updates: Record<string, unknown> = {};
  if (patch.slug !== undefined) updates.slug = patch.slug;
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.ordinal !== undefined) updates.ordinal = patch.ordinal;
  if (patch.color !== undefined) updates.color = patch.color;
  if (patch.is_initial !== undefined) updates.is_initial = patch.is_initial;
  if (patch.is_terminal !== undefined) updates.is_terminal = patch.is_terminal;

  const { data, error } = await db
    .from('lifecycle_stages')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Stage;
}

export async function deleteStage(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  // Participants FK is on delete restrict — DB will refuse if anyone is still in this stage.
  const { error } = await db.from('lifecycle_stages').delete().eq('id', id);
  if (error) throw error;
}

export async function countParticipantsInStage(stageId: string): Promise<number> {
  const db = getSupabaseAdmin();
  const { count, error } = await db
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('lifecycle_stage_id', stageId);
  if (error) throw error;
  return count ?? 0;
}

export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}
