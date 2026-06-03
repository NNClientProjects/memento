-- Configurable rules engine on top of the lifecycle_stages table.
-- A rule has a trigger (stale-for-N-days-in-stage), one of two actions
-- (send_template, change_stage), and a per-(rule, participant) cooldown.
-- Every firing is logged for cooldown checks and for the audit/debug UI.

------------------------------------------------------------------------
-- stage_rules
------------------------------------------------------------------------
create table if not exists stage_rules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  description text,
  enabled boolean not null default true,

  -- Trigger: participant has been in trigger_stage_id for at least N days.
  trigger_stage_id uuid not null references lifecycle_stages(id) on delete cascade,
  trigger_stale_days int not null default 7
    check (trigger_stale_days >= 0 and trigger_stale_days <= 365),

  -- Action: exactly one of these populated, based on action_type.
  action_type text not null
    check (action_type in ('send_template', 'change_stage')),
  action_template_id uuid references templates(id) on delete set null,
  action_target_stage_id uuid references lifecycle_stages(id) on delete set null,

  -- Cooldown: don't fire this rule again for the same participant within this
  -- many hours. 0 = no cooldown (use sparingly — every engine run will fire).
  cooldown_hours int not null default 24
    check (cooldown_hours >= 0 and cooldown_hours <= 24 * 365),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stage_rules_event_enabled
  on stage_rules(event_id, enabled);
create index if not exists idx_stage_rules_trigger_stage
  on stage_rules(trigger_stage_id);

create trigger stage_rules_updated_at before update on stage_rules
  for each row execute function set_updated_at();

------------------------------------------------------------------------
-- rule_firings  (audit + cooldown source)
------------------------------------------------------------------------
create table if not exists rule_firings (
  id bigserial primary key,
  rule_id uuid not null references stage_rules(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  fired_at timestamptz not null default now(),
  outcome text not null check (outcome in ('success', 'skipped', 'failed')),
  skip_reason text,
  error text,
  details jsonb
);

-- Look up last firing per (rule, participant) for cooldown — desc index speeds the LIMIT 1.
create index if not exists idx_rule_firings_rule_participant_recent
  on rule_firings(rule_id, participant_id, fired_at desc);

-- Recent activity feed (for /automations page and per-rule debug).
create index if not exists idx_rule_firings_recent
  on rule_firings(fired_at desc);
