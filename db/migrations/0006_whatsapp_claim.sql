-- Tracks whether a participant's phone has been "claimed" with the WhatsApp router backend.
-- The router owns the inbound webhook for the shared WhatsApp Business number; claim tells it
-- which app owns replies from this contact. See docs/whatsapp-router-spec.md.
-- Null = not yet claimed. Set to now() after a successful POST to /contacts/claim.

alter table participants
  add column if not exists whatsapp_claimed_at timestamptz;

create index if not exists idx_participants_whatsapp_claim_pending
  on participants(event_id)
  where phone_e164 is not null and whatsapp_claimed_at is null;
