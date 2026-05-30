-- Seed the first event row. Re-runnable via the on-conflict clause.

insert into events (slug, name, type, currency, master_sheet_id, config)
values (
  'reunion-2026',
  'Reunion 2026',
  'reunion',
  'INR',
  '1EFbLg-1TAXwTlneeVTkP5M4x8bQ7mWAlF-Q6Q4Ii6Ng',
  jsonb_build_object(
    'advance_amount', 25000,
    'suite_upgrade_amount_per_night', 15000,
    'room_rules', jsonb_build_object(
      'max_adults_per_room', 2,
      'max_kids_12plus_per_room', 1,
      'kids_under_12_free', true
    )
  )
)
on conflict (slug) do update
set name = excluded.name,
    master_sheet_id = excluded.master_sheet_id,
    config = excluded.config;
