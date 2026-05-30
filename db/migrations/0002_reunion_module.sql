-- Reunion-specific extensions: per-attendee details, faculty module, T-Night nominations,
-- and raw form-response capture. Generic core stays untouched.

create table reunion_attendees (
  participant_id uuid primary key references participants(id) on delete cascade,
  batch int,
  dorm text,
  dorm_number text,
  section text,
  spouse_name text,
  spouse_dorm text,
  spouse_dorm_number text,
  meal_pref text,
  needs_room boolean default false,
  room_count int default 0,
  suite_upgrade boolean default false,
  extend_stay boolean default false,
  attendee_composition text,
  kids jsonb not null default '{}'::jsonb,
  extra_adults jsonb not null default '[]'::jsonb,
  freeform_notes text,
  advance_paid boolean default false
);

create index idx_reunion_dorm on reunion_attendees(dorm, dorm_number);
create index idx_reunion_section on reunion_attendees(section);
create index idx_reunion_room on reunion_attendees(needs_room) where needs_room = true;

create table faculty (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  email text,
  phone_e164 text,
  lifecycle_stage text not null default 'not_contacted',
  assigned_organiser_id uuid references organisers(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_faculty_event ON faculty(event_id, lifecycle_stage);

create table faculty_nominations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  nominator_participant_id uuid references participants(id) on delete set null,
  nominee_name text not null,
  linked_faculty_id uuid references faculty(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_faculty_nominations_name on faculty_nominations(event_id, nominee_name);

create table tnight_nominations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  nominator_participant_id uuid references participants(id) on delete set null,
  nominee_name text not null,
  performance_type text,
  linked_participant_id uuid references participants(id) on delete set null,
  status text not null default 'nominated',
  created_at timestamptz not null default now()
);

create index idx_tnight_nominations_name on tnight_nominations(event_id, nominee_name);
create index idx_tnight_nominations_status on tnight_nominations(event_id, status);

create table form_responses_raw (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  form_response_id text,
  submitted_at timestamptz,
  raw_data jsonb not null,
  matched_participant_id uuid references participants(id) on delete set null,
  processed_at timestamptz,
  unique (event_id, form_response_id)
);

create index idx_form_responses_matched on form_responses_raw(event_id, matched_participant_id);

create trigger faculty_updated_at before update on faculty
  for each row execute function set_updated_at();
