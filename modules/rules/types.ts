export type RuleActionType = 'send_template' | 'change_stage';

export type Rule = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  enabled: boolean;

  trigger_stage_id: string;
  trigger_stale_days: number;

  action_type: RuleActionType;
  action_template_id: string | null;
  action_target_stage_id: string | null;

  cooldown_hours: number;

  created_at: string;
  updated_at: string;
};

export type RuleOutcome = 'success' | 'skipped' | 'failed';

export type RuleFiring = {
  id: number;
  rule_id: string;
  participant_id: string;
  fired_at: string;
  outcome: RuleOutcome;
  skip_reason: string | null;
  error: string | null;
  details: Record<string, unknown> | null;
};

export const SKIP_REASONS = {
  cooldown: 'cooldown',
  opted_out: 'opted_out',
  no_email: 'no_email',
  no_phone: 'no_phone',
  no_template: 'no_template',
  template_not_approved: 'template_not_approved',
  template_channel_mismatch: 'template_channel_mismatch',
  no_target_stage: 'no_target_stage',
  already_in_target_stage: 'already_in_target_stage',
  grace_window: 'grace_window',
} as const;
