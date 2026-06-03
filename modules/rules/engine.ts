import { getSupabaseAdmin } from '@/lib/supabase';
import { getStage } from '@/modules/stages/repository';
import {
  changeLifecycleStage,
  type WritebackOutcome,
} from '@/modules/participants/services';
import { sendTemplate } from '@/modules/communications/send';
import { getTemplate } from '@/modules/communications/repository';
import { isOptedOut } from '@/modules/communications/opt-out';
import { getCurrentEvent } from '@/lib/event-context';
import { listRules, lastFiringAt } from './repository';
import type { Participant } from '@/modules/participants/types';
import { SKIP_REASONS, type Rule, type RuleOutcome } from './types';

export type RunSummary = {
  rulesEvaluated: number;
  rulesEnabled: number;
  candidatesConsidered: number;
  fired: number;
  skipped: Record<string, number>;
  failed: number;
  perRule: Array<{
    ruleId: string;
    ruleName: string;
    candidates: number;
    fired: number;
    skipped: number;
    failed: number;
  }>;
};

async function recordFiring(
  ruleId: string,
  participantId: string,
  outcome: RuleOutcome,
  extras: { skip_reason?: string; error?: string; details?: Record<string, unknown> } = {}
): Promise<void> {
  const db = getSupabaseAdmin();
  await db.from('rule_firings').insert({
    rule_id: ruleId,
    participant_id: participantId,
    outcome,
    skip_reason: extras.skip_reason ?? null,
    error: extras.error ?? null,
    details: extras.details ?? null,
  });
}

async function evaluateRule(
  rule: Rule,
  eventName: string,
  summary: RunSummary
): Promise<void> {
  const db = getSupabaseAdmin();
  const perRule = {
    ruleId: rule.id,
    ruleName: rule.name,
    candidates: 0,
    fired: 0,
    skipped: 0,
    failed: 0,
  };

  const cutoff = new Date(
    Date.now() - rule.trigger_stale_days * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await db
    .from('participants')
    .select('*')
    .eq('event_id', rule.event_id)
    .eq('lifecycle_stage_id', rule.trigger_stage_id)
    .lte('entered_current_stage_at', cutoff);
  if (error) throw error;
  const candidates = (data ?? []) as Participant[];
  perRule.candidates = candidates.length;
  summary.candidatesConsidered += candidates.length;

  for (const p of candidates) {
    // 1. Cooldown
    if (rule.cooldown_hours > 0) {
      const last = await lastFiringAt(rule.id, p.id);
      if (last) {
        const ageMs = Date.now() - new Date(last).getTime();
        const cooldownMs = rule.cooldown_hours * 60 * 60 * 1000;
        if (ageMs < cooldownMs) {
          await recordFiring(rule.id, p.id, 'skipped', {
            skip_reason: SKIP_REASONS.cooldown,
            details: { last_fired_at: last, cooldown_hours: rule.cooldown_hours },
          });
          summary.skipped[SKIP_REASONS.cooldown] =
            (summary.skipped[SKIP_REASONS.cooldown] ?? 0) + 1;
          perRule.skipped += 1;
          continue;
        }
      }
    }

    // 2. Execute action
    if (rule.action_type === 'send_template') {
      await fireSendTemplate(rule, p, eventName, summary, perRule);
    } else if (rule.action_type === 'change_stage') {
      await fireChangeStage(rule, p, summary, perRule);
    }
  }

  summary.perRule.push(perRule);
}

async function fireSendTemplate(
  rule: Rule,
  p: Participant,
  eventName: string,
  summary: RunSummary,
  perRule: { fired: number; skipped: number; failed: number }
): Promise<void> {
  const recordSkip = async (reason: string) => {
    await recordFiring(rule.id, p.id, 'skipped', { skip_reason: reason });
    summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
    perRule.skipped += 1;
  };

  if (!rule.action_template_id) {
    await recordSkip(SKIP_REASONS.no_template);
    return;
  }
  const template = await getTemplate(rule.action_template_id);
  if (!template) {
    await recordSkip(SKIP_REASONS.no_template);
    return;
  }
  if (template.status !== 'approved') {
    await recordSkip(SKIP_REASONS.template_not_approved);
    return;
  }

  if (await isOptedOut(p.id, template.channel)) {
    await recordSkip(SKIP_REASONS.opted_out);
    return;
  }
  if (template.channel === 'email' && !p.email) {
    await recordSkip(SKIP_REASONS.no_email);
    return;
  }
  if (template.channel === 'whatsapp' && !p.phone_e164) {
    await recordSkip(SKIP_REASONS.no_phone);
    return;
  }
  if (template.channel !== 'email' && template.channel !== 'whatsapp') {
    await recordSkip(SKIP_REASONS.template_channel_mismatch);
    return;
  }

  try {
    const outcome = await sendTemplate({
      templateId: template.id,
      recipientIds: [p.id],
      dryRun: false,
      eventId: p.event_id,
      eventName,
    });
    if (outcome.ok && outcome.sent > 0) {
      await recordFiring(rule.id, p.id, 'success', {
        details: {
          action: 'send_template',
          template_id: template.id,
          channel: template.channel,
        },
      });
      summary.fired += 1;
      perRule.fired += 1;
    } else if (outcome.ok && outcome.failed > 0) {
      const err =
        outcome.recipients[0]?.error ?? 'send failed (no recipient detail)';
      await recordFiring(rule.id, p.id, 'failed', { error: err });
      summary.failed += 1;
      perRule.failed += 1;
    } else if (outcome.ok && outcome.skipped > 0) {
      // sendTemplate already de-duped or detected opt-out
      const reason =
        outcome.recipients[0]?.error ?? 'send-side skip';
      await recordFiring(rule.id, p.id, 'skipped', { skip_reason: reason });
      summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
      perRule.skipped += 1;
    } else if (!outcome.ok) {
      await recordFiring(rule.id, p.id, 'failed', { error: outcome.error });
      summary.failed += 1;
      perRule.failed += 1;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordFiring(rule.id, p.id, 'failed', { error: msg });
    summary.failed += 1;
    perRule.failed += 1;
  }
}

async function fireChangeStage(
  rule: Rule,
  p: Participant,
  summary: RunSummary,
  perRule: { fired: number; skipped: number; failed: number }
): Promise<void> {
  const recordSkip = async (reason: string) => {
    await recordFiring(rule.id, p.id, 'skipped', { skip_reason: reason });
    summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
    perRule.skipped += 1;
  };

  if (!rule.action_target_stage_id) {
    await recordSkip(SKIP_REASONS.no_target_stage);
    return;
  }
  if (rule.action_target_stage_id === p.lifecycle_stage_id) {
    await recordSkip(SKIP_REASONS.already_in_target_stage);
    return;
  }
  const target = await getStage(rule.action_target_stage_id);
  if (!target) {
    await recordSkip(SKIP_REASONS.no_target_stage);
    return;
  }

  try {
    const outcome: WritebackOutcome = await changeLifecycleStage({
      participantId: p.id,
      newStageId: rule.action_target_stage_id,
      reason: `auto: ${rule.name}`,
    });
    if (outcome.ok) {
      await recordFiring(rule.id, p.id, 'success', {
        details: {
          action: 'change_stage',
          target_stage_id: target.id,
          target_stage_name: target.name,
          writeback: outcome.written,
        },
      });
      summary.fired += 1;
      perRule.fired += 1;
    } else if (outcome.reason === 'grace') {
      // DB advanced; sheet writeback paused — still count the firing as success
      // (the rule did its job) but log the grace skip detail.
      await recordFiring(rule.id, p.id, 'success', {
        details: {
          action: 'change_stage',
          target_stage_id: target.id,
          sheet_writeback: 'paused_grace_window',
          pending_until: outcome.pendingUntil,
        },
      });
      summary.fired += 1;
      perRule.fired += 1;
    } else {
      await recordFiring(rule.id, p.id, 'success', {
        details: {
          action: 'change_stage',
          target_stage_id: target.id,
          sheet_writeback: outcome.reason,
        },
      });
      summary.fired += 1;
      perRule.fired += 1;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordFiring(rule.id, p.id, 'failed', { error: msg });
    summary.failed += 1;
    perRule.failed += 1;
  }
}

export async function runAutomations(): Promise<RunSummary> {
  const event = await getCurrentEvent();
  const allRules = await listRules(event.id);

  const summary: RunSummary = {
    rulesEvaluated: allRules.length,
    rulesEnabled: 0,
    candidatesConsidered: 0,
    fired: 0,
    skipped: {},
    failed: 0,
    perRule: [],
  };

  for (const rule of allRules) {
    if (!rule.enabled) continue;
    summary.rulesEnabled += 1;
    await evaluateRule(rule, event.name, summary);
  }

  return summary;
}
