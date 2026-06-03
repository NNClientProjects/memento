import { getSupabaseAdmin } from '@/lib/supabase';
import type { Rule, RuleFiring } from './types';

export async function listRules(eventId: string): Promise<Rule[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('stage_rules')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Rule[];
}

export async function getRule(id: string): Promise<Rule | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('stage_rules')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Rule | null) ?? null;
}

export type RuleInput = {
  eventId: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
  trigger_stage_id: string;
  trigger_stale_days: number;
  action_type: Rule['action_type'];
  action_template_id?: string | null;
  action_target_stage_id?: string | null;
  cooldown_hours?: number;
};

export async function createRule(input: RuleInput): Promise<Rule> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('stage_rules')
    .insert({
      event_id: input.eventId,
      name: input.name,
      description: input.description ?? null,
      enabled: input.enabled ?? true,
      trigger_stage_id: input.trigger_stage_id,
      trigger_stale_days: input.trigger_stale_days,
      action_type: input.action_type,
      action_template_id: input.action_template_id ?? null,
      action_target_stage_id: input.action_target_stage_id ?? null,
      cooldown_hours: input.cooldown_hours ?? 24,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Rule;
}

export async function updateRule(
  id: string,
  patch: Partial<RuleInput>
): Promise<Rule> {
  const db = getSupabaseAdmin();
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.enabled !== undefined) updates.enabled = patch.enabled;
  if (patch.trigger_stage_id !== undefined)
    updates.trigger_stage_id = patch.trigger_stage_id;
  if (patch.trigger_stale_days !== undefined)
    updates.trigger_stale_days = patch.trigger_stale_days;
  if (patch.action_type !== undefined) updates.action_type = patch.action_type;
  if (patch.action_template_id !== undefined)
    updates.action_template_id = patch.action_template_id;
  if (patch.action_target_stage_id !== undefined)
    updates.action_target_stage_id = patch.action_target_stage_id;
  if (patch.cooldown_hours !== undefined)
    updates.cooldown_hours = patch.cooldown_hours;

  const { data, error } = await db
    .from('stage_rules')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Rule;
}

export async function deleteRule(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from('stage_rules').delete().eq('id', id);
  if (error) throw error;
}

export async function recentFiringsForRule(
  ruleId: string,
  limit = 20
): Promise<RuleFiring[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('rule_firings')
    .select('*')
    .eq('rule_id', ruleId)
    .order('fired_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RuleFiring[];
}

export async function recentFiringsForEvent(
  eventId: string,
  limit = 50
): Promise<RuleFiring[]> {
  const db = getSupabaseAdmin();
  // Join via rule to filter by event.
  const { data, error } = await db
    .from('rule_firings')
    .select('*, rule:stage_rules!inner(event_id)')
    .eq('rule.event_id', eventId)
    .order('fired_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RuleFiring[];
}

// For cooldown check: returns the latest fired_at for this (rule, participant) pair, or null.
export async function lastFiringAt(
  ruleId: string,
  participantId: string
): Promise<string | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('rule_firings')
    .select('fired_at')
    .eq('rule_id', ruleId)
    .eq('participant_id', participantId)
    .order('fired_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return ((data as { fired_at: string } | null)?.fired_at) ?? null;
}

// "If I ran this rule right now, how many participants would it consider?"
// Pure DB query — does NOT apply cooldown or opt-out filters (those need per-row work).
export async function countCandidatesForRule(rule: Rule): Promise<number> {
  const db = getSupabaseAdmin();
  const cutoff = new Date(
    Date.now() - rule.trigger_stale_days * 24 * 60 * 60 * 1000
  ).toISOString();
  const { count, error } = await db
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', rule.event_id)
    .eq('lifecycle_stage_id', rule.trigger_stage_id)
    .lte('entered_current_stage_at', cutoff);
  if (error) throw error;
  return count ?? 0;
}
