-- Sheet/DB reconciliation state for the 5-min grace window.
-- sheet_tracking_snapshot: the values we last observed for the row's tracking columns
--   (keyed by Sheet header name, e.g., {"Lifecycle Stage": "registered", ...}).
-- sheet_tracking_synced_at: when we last successfully wrote back to the Sheet.
-- sheet_edit_detected_at: when sync first observed sheet drift since our last snapshot
--   (i.e., an organiser edited the Sheet). Used to gate writebacks during grace.

alter table participants
  add column if not exists sheet_tracking_snapshot jsonb,
  add column if not exists sheet_tracking_synced_at timestamptz,
  add column if not exists sheet_edit_detected_at timestamptz;

create index if not exists idx_participants_edit_detected
  on participants(sheet_edit_detected_at)
  where sheet_edit_detected_at is not null;
