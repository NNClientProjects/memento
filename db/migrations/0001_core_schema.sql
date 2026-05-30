-- Core, event-agnostic schema for Memento.
-- Per-event extensions (e.g., reunion fields, T-Night) live in their own migrations.

create extension if not exists pgcrypto;

create type lifecycle_stage as enum (
  'not_contacted',
  'contacted_no_response',
  'responded_not_interested',
  'responded_unsure',
  'responded_interested_not_registered',
  'registered',
  'dropped',
  'checked_in'
);

create type payment_status as enum (
  'not_due',
  'advance_pending',
  'advance_paid',
  'fully_paid',
  'refunded'
);

create type comm_channel as enum ('email', 'whatsapp', 'phone', 'in_person');
create type comm_direction as enum ('outbound', 'inbound');
create type comm_status as enum ('queued', 'sent', 'delivered', 'read', 'failed');
create type template_status as enum ('draft', 'pending_approval', 'approved', 'rejected');
create type organiser_role as enum ('admin', 'coordinator', 'readonly');
create type event_type as enum ('reunion', 'conference', 'wedding', 'other');

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  type event_type not null default 'reunion',
  starts_on date,
  ends_on date,
  venue text,
  currency text not null default 'INR',
  master_sheet_id text,
  form_responses_sheet_id text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organisers (
  id uuid primary key,
  email text unique not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table event_organisers (
  event_id uuid not null references events(id) on delete cascade,
  organiser_id uuid not null references organisers(id) on delete cascade,
  role organiser_role not null default 'coordinator',
  primary key (event_id, organiser_id)
);

create table family_units (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  full_name text not null,
  email text,
  phone_e164 text,
  alt_phone text,
  current_city text,
  current_country text,
  family_unit_id uuid references family_units(id) on delete set null,
  lifecycle_stage lifecycle_stage not null default 'not_contacted',
  payment_status payment_status not null default 'not_due',
  assigned_organiser_id uuid references organisers(id) on delete set null,
  last_contacted_at timestamptz,
  last_contacted_channel comm_channel,
  self_reported_status text,
  form_submitted_at timestamptz,
  sheet_row_number int,
  source text,
  added_by uuid references organisers(id) on delete set null,
  notes text,
  custom jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, email),
  check (email is not null or phone_e164 is not null)
);

create index idx_participants_event_lifecycle on participants(event_id, lifecycle_stage);
create index idx_participants_event_assigned on participants(event_id, assigned_organiser_id);
create index idx_participants_phone on participants(phone_e164) where phone_e164 is not null;
create index idx_participants_sheet_row on participants(event_id, sheet_row_number) where sheet_row_number is not null;

create table lifecycle_history (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  from_stage lifecycle_stage,
  to_stage lifecycle_stage not null,
  changed_by uuid references organisers(id) on delete set null,
  reason text,
  changed_at timestamptz not null default now()
);

create index idx_lifecycle_history_participant on lifecycle_history(participant_id, changed_at desc);

create table tags (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  color text,
  unique (event_id, name)
);

create table participant_tags (
  participant_id uuid not null references participants(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (participant_id, tag_id)
);

create table templates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  channel comm_channel not null,
  name text not null,
  subject text,
  body text not null,
  merge_fields text[] not null default '{}',
  provider_template_id text,
  status template_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, channel, name)
);

create table communications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  participant_id uuid references participants(id) on delete set null,
  channel comm_channel not null,
  direction comm_direction not null,
  template_id uuid references templates(id) on delete set null,
  subject text,
  body text,
  status comm_status not null default 'queued',
  sent_by uuid references organisers(id) on delete set null,
  external_id text,
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_comms_participant on communications(participant_id, created_at desc);
create index idx_comms_event_status on communications(event_id, status);
create index idx_comms_external_id on communications(external_id) where external_id is not null;

create table opt_outs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  channel comm_channel not null,
  opted_out_at timestamptz not null default now(),
  reason text,
  unique (participant_id, channel)
);

create table audit_log (
  id bigserial primary key,
  event_id uuid references events(id) on delete set null,
  actor_organiser_id uuid references organisers(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create index idx_audit_entity on audit_log(entity_type, entity_id, at desc);

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete set null,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  summary jsonb,
  error text
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger events_updated_at before update on events
  for each row execute function set_updated_at();
create trigger participants_updated_at before update on participants
  for each row execute function set_updated_at();
create trigger templates_updated_at before update on templates
  for each row execute function set_updated_at();
