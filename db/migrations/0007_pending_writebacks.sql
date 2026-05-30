-- When writebackParticipantTracking is blocked by the 5-min grace window
-- (sheet_edit_detected_at is recent), the intended Sheet update is queued here.
-- The sync orchestrator (and a manual "Reconcile now" trigger) drains this queue
-- by calling writebackParticipantTracking again — which re-checks grace, and if
-- expired, succeeds and removes the row.
--
-- One row per participant: a new queue request for an already-queued participant
-- merges into the existing row's `updates` jsonb (latest value per column wins).

create table if not exists pending_writebacks (
  participant_id uuid primary key references participants(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  updates jsonb not null,
  queued_at timestamptz not null default now(),
  attempts int not null default 0,
  last_attempt_at timestamptz,
  last_error text
);

create index if not exists idx_pending_writebacks_event_queued
  on pending_writebacks(event_id, queued_at);
