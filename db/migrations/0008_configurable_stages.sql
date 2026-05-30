-- Replace the hardcoded `lifecycle_stage` Postgres enum with a per-event
-- configurable `lifecycle_stages` table. Each event defines its own stages
-- (name, slug, sort order, color, initial/terminal flags). Participants and
-- lifecycle_history reference stages by uuid FK.
--
-- All current participant data is test data per user confirmation 2026-05-30,
-- so this migration backfills cleanly using slug = old enum value, then drops
-- the enum column and type.

------------------------------------------------------------------------
-- 1. lifecycle_stages table
------------------------------------------------------------------------
create table if not exists lifecycle_stages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  ordinal int not null default 0,
  color text not null default 'zinc',
  is_initial boolean not null default false,
  is_terminal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, slug)
);

create index if not exists idx_lifecycle_stages_event_ordinal
  on lifecycle_stages(event_id, ordinal);

-- Only one initial stage per event.
create unique index if not exists idx_lifecycle_stages_one_initial
  on lifecycle_stages(event_id) where is_initial = true;

create trigger lifecycle_stages_updated_at before update on lifecycle_stages
  for each row execute function set_updated_at();

------------------------------------------------------------------------
-- 2. Seed the reunion-2026 event with the previous 8 stages
------------------------------------------------------------------------
insert into lifecycle_stages (event_id, slug, name, ordinal, color, is_initial, is_terminal)
select e.id, s.slug, s.name, s.ordinal, s.color, s.is_initial, s.is_terminal
from events e
cross join (values
  ('not_contacted',                       'Not contacted',              10, 'zinc',    true,  false),
  ('contacted_no_response',               'Contacted, no response',     20, 'amber',   false, false),
  ('responded_not_interested',            'Not interested',             30, 'red',     false, true),
  ('responded_unsure',                    'Unsure',                     40, 'yellow',  false, false),
  ('responded_interested_not_registered', 'Interested, not registered', 50, 'blue',    false, false),
  ('registered',                          'Registered',                 60, 'green',   false, false),
  ('dropped',                             'Dropped',                    70, 'zinc',    false, true),
  ('checked_in',                          'Checked in',                 80, 'emerald', false, true)
) as s(slug, name, ordinal, color, is_initial, is_terminal)
where e.slug = 'reunion-2026'
on conflict (event_id, slug) do nothing;

------------------------------------------------------------------------
-- 3. Add new FK columns + stage-entry timestamp on participants
------------------------------------------------------------------------
alter table participants
  add column if not exists lifecycle_stage_id uuid references lifecycle_stages(id) on delete restrict,
  add column if not exists entered_current_stage_at timestamptz;

-- Backfill lifecycle_stage_id from the old enum column.
update participants p
set lifecycle_stage_id = s.id
from lifecycle_stages s
where s.event_id = p.event_id
  and s.slug = p.lifecycle_stage::text
  and p.lifecycle_stage_id is null;

-- Backfill entered_current_stage_at from updated_at (best available proxy).
update participants
set entered_current_stage_at = coalesce(updated_at, created_at, now())
where entered_current_stage_at is null;

alter table participants
  alter column lifecycle_stage_id set not null,
  alter column entered_current_stage_at set not null,
  alter column entered_current_stage_at set default now();

create index if not exists idx_participants_event_stage
  on participants(event_id, lifecycle_stage_id);
create index if not exists idx_participants_stage_entered
  on participants(lifecycle_stage_id, entered_current_stage_at);

------------------------------------------------------------------------
-- 4. Migrate lifecycle_history to FKs
------------------------------------------------------------------------
alter table lifecycle_history
  add column if not exists from_stage_id uuid references lifecycle_stages(id) on delete set null,
  add column if not exists to_stage_id uuid references lifecycle_stages(id) on delete set null;

update lifecycle_history h
set from_stage_id = s.id
from lifecycle_stages s, participants p
where p.id = h.participant_id
  and s.event_id = p.event_id
  and h.from_stage is not null
  and s.slug = h.from_stage::text
  and h.from_stage_id is null;

update lifecycle_history h
set to_stage_id = s.id
from lifecycle_stages s, participants p
where p.id = h.participant_id
  and s.event_id = p.event_id
  and s.slug = h.to_stage::text
  and h.to_stage_id is null;

alter table lifecycle_history
  alter column to_stage_id set not null;

------------------------------------------------------------------------
-- 5. Drop the old enum-backed columns and the type
------------------------------------------------------------------------
-- Drop old indexes that reference the enum column first.
drop index if exists idx_participants_event_lifecycle;
drop index if exists idx_lifecycle_history_participant;

alter table participants drop column if exists lifecycle_stage;
alter table lifecycle_history drop column if exists from_stage;
alter table lifecycle_history drop column if exists to_stage;

-- Recreate the history-by-participant index without the enum reference.
create index if not exists idx_lifecycle_history_participant
  on lifecycle_history(participant_id, changed_at desc);

-- Drop the enum type itself (nothing references it now).
drop type if exists lifecycle_stage;
