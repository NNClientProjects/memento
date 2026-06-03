'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentEventId } from '@/lib/event-context';
import {
  createRule,
  updateRule,
  deleteRule,
} from './repository';
import { runAutomations, type RunSummary } from './engine';

export type RuleActionResult =
  | { ok: true; message: string; ruleId?: string }
  | { ok: false; error: string };

function parseRuleForm(formData: FormData): {
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_stage_id: string;
  trigger_stale_days: number;
  action_type: 'send_template' | 'change_stage';
  action_template_id: string | null;
  action_target_stage_id: string | null;
  cooldown_hours: number;
} | { error: string } {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const enabled = formData.get('enabled') === '1';
  const trigger_stage_id = String(formData.get('trigger_stage_id') ?? '');
  const trigger_stale_days = Number(formData.get('trigger_stale_days') ?? 7);
  const action_type = String(formData.get('action_type') ?? '') as
    | 'send_template'
    | 'change_stage';
  const action_template_id = String(formData.get('action_template_id') ?? '') || null;
  const action_target_stage_id = String(formData.get('action_target_stage_id') ?? '') || null;
  const cooldown_hours = Number(formData.get('cooldown_hours') ?? 24);

  if (!name) return { error: 'name is required' };
  if (!trigger_stage_id) return { error: 'trigger stage is required' };
  if (!Number.isFinite(trigger_stale_days) || trigger_stale_days < 0)
    return { error: 'stale days must be a non-negative number' };
  if (action_type !== 'send_template' && action_type !== 'change_stage')
    return { error: 'pick an action type' };
  if (action_type === 'send_template' && !action_template_id)
    return { error: 'pick a template for send_template' };
  if (action_type === 'change_stage' && !action_target_stage_id)
    return { error: 'pick a target stage for change_stage' };
  if (!Number.isFinite(cooldown_hours) || cooldown_hours < 0)
    return { error: 'cooldown hours must be a non-negative number' };

  return {
    name,
    description,
    enabled,
    trigger_stage_id,
    trigger_stale_days,
    action_type,
    action_template_id: action_type === 'send_template' ? action_template_id : null,
    action_target_stage_id:
      action_type === 'change_stage' ? action_target_stage_id : null,
    cooldown_hours,
  };
}

export async function createRuleAction(
  _prev: RuleActionResult | null,
  formData: FormData
): Promise<RuleActionResult> {
  const parsed = parseRuleForm(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };

  try {
    const eventId = await getCurrentEventId();
    const rule = await createRule({ eventId, ...parsed });
    revalidatePath('/automations');
    return { ok: true, message: `Rule "${rule.name}" created.`, ruleId: rule.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateRuleAction(
  _prev: RuleActionResult | null,
  formData: FormData
): Promise<RuleActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'missing rule id' };
  const parsed = parseRuleForm(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  try {
    await updateRule(id, parsed);
    revalidatePath('/automations');
    revalidatePath(`/automations/${id}`);
    return { ok: true, message: 'Rule saved.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteRuleAction(
  _prev: RuleActionResult | null,
  formData: FormData
): Promise<RuleActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'missing rule id' };
  try {
    await deleteRule(id);
    revalidatePath('/automations');
    return { ok: true, message: 'Rule deleted.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type RunResult =
  | { ok: true; summary: RunSummary; severity: 'success' | 'warning' }
  | { ok: false; error: string };

export async function runAutomationsAction(
  _prev: RunResult | null,
  _formData: FormData
): Promise<RunResult> {
  try {
    const summary = await runAutomations();
    revalidatePath('/automations');
    revalidatePath('/setup');
    revalidatePath('/participants');
    const severity: 'success' | 'warning' =
      summary.failed > 0 ? 'warning' : 'success';
    return { ok: true, summary, severity };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
