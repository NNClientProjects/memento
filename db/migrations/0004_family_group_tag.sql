-- Simplify family modeling: drop the family_units entity; family becomes a string tag
-- on each participant row. Both spouses remain independent rows; the tag groups
-- them for room allocation. Null when there is no spouse in the event.
--
-- Safe to run as-is: family_units is empty and participants.family_unit_id is all null.

alter table participants drop column if exists family_unit_id;
alter table participants add column if not exists family_group_id text;

create index if not exists idx_participants_family_group
  on participants(event_id, family_group_id)
  where family_group_id is not null;

drop table if exists family_units;
