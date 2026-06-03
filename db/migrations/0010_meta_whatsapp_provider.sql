-- Meta WhatsApp Cloud API support on templates.
-- We reuse the existing provider_template_id column to store the
-- Meta-approved template name (e.g. 'reunion_initial_outreach').
-- Language code is BCP-47 like 'en', 'en_US', 'hi'.
--
-- Positional parameter order ({{1}}, {{2}}, ...) is derived from
-- templates.merge_fields[] at send time — the organiser is responsible for
-- keeping their Meta-side template parameter order aligned with our merge
-- field order.

alter table templates
  add column if not exists provider_language_code text not null default 'en';
