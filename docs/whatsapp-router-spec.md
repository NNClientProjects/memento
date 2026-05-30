# WhatsApp Router — cross-app contact ownership and inbound routing

Spec for the **other backend** (the one that currently receives Meta WhatsApp webhooks for the shared business number). This document describes the small additions that backend needs so multiple apps can share a single WhatsApp Business number without auto-reply collisions.

Owner of this spec: nlightn / event-mgmt-app (Reunion 2026). Last updated 2026-05-30.

**Implementation note (2026-05-30):** the live router exposes claim at `POST /v2/webhooks/contacts/claim`, not the originally-spec'd `POST /api/external/whatsapp/contacts/claim`. The event-mgmt-app uses `ROUTER_CLAIM_PATH` env var (defaulted to `/v2/webhooks/contacts/claim`) so the path can change without code edits. Auth/payload/response shapes below are still authoritative.

## Why this exists

Meta sends inbound WhatsApp webhooks to **exactly one URL per phone number**. We want to share one verified business number between:
- The existing app (this router backend) — current webhook target
- The event-mgmt-app (Reunion 2026, the new caller of this spec) — wants to send and receive too

Constraint: when a reunion participant replies to a message sent by the event-mgmt-app, the router (which receives the webhook) must NOT auto-reply on behalf of the existing app. It should forward that message to the event-mgmt-app and stay quiet.

Solution: a **contact-ownership registry** on the router. Each phone number is owned by exactly one app at a time. On inbound, the router looks up the owner and routes accordingly.

## Architecture

```
                   ┌────────────────────────────────┐
                   │  Router backend (existing)     │
                   │                                │
                   │  - Receives all Meta webhooks  │
                   │  - Stores contact ownership    │
                   │  - Routes inbound by owner     │
                   └─┬──────────────────────┬───────┘
                     │                      │
   inbound webhook   │                      │ forwards inbound if owner ≠ self
   from Meta         │                      ▼
                     │           ┌──────────────────────────────┐
                     │           │  event-mgmt-app (Reunion)    │
                     │           │  POST /api/whatsapp/inbound  │
                     │           │  Inbox UI                    │
                     │           └─────────────▲────────────────┘
                     │                         │
                     │                         │  POST /contacts/claim
                     │  ◄──────────────────────┤  (on participant sync)
                     │                         │
                     │                         ▼
                     │              Meta Cloud API (direct outbound)
                     ▼
            Existing inbound logic for non-reunion contacts
```

## Endpoints to implement on the router backend

### 1. `POST /v2/webhooks/contacts/claim` *(live path; was `/api/external/whatsapp/contacts/claim` in original spec)*

Idempotent. Stores ownership of a phone number. Called by the event-mgmt-app whenever it syncs participants from the master Google Sheet (so the router knows about reunion contacts before any reply lands).

**Auth:** `Authorization: Bearer <ROUTER_API_SECRET>` header.

**Request body** (JSON):

```json
{
  "phone": "+919876543210",
  "owner": "reunion-2026",
  "claimed_at": "2026-05-28T10:15:00.000Z",
  "metadata": {
    "participant_id": "f1b2c3d4-...",
    "full_name": "Test One",
    "event_name": "Reunion 2026",
    "event_slug": "reunion-2026"
  }
}
```

**Success response (200):**

```json
{
  "ok": true,
  "owner": "reunion-2026",
  "previous_owner": null
}
```

**Conflict (still 200, last-writer-wins):**

If the phone was previously owned by a different app, you still update ownership to the new owner, but return the previous owner so the caller can audit the swap on its side too:

```json
{
  "ok": true,
  "owner": "reunion-2026",
  "previous_owner": "other-app-name"
}
```

You should also audit the swap on the router side (table `contact_ownership_audit` or similar).

**Errors:**
- `401` — auth header missing or wrong
- `400` — body missing `phone` or `owner`, or `phone` not in E.164 format
- `500` — storage failure

### 2. `POST /api/external/whatsapp/contacts/release` *(optional, deferred to Phase 3)*

Reverses a claim. Same auth. Body `{ phone, owner }`. 200 if `owner` matches and release succeeded; 409 if owner doesn't match.

Not needed for Phase 2.

## Storage on router backend

Suggested schema (whatever DB the router uses):

```sql
create table contact_ownership (
  phone_e164 text primary key,
  owner text not null,             -- e.g., 'reunion-2026', 'app-x', 'app-y'
  claimed_at timestamptz not null,
  metadata jsonb,
  updated_at timestamptz not null default now()
);

create table contact_ownership_audit (
  id bigserial primary key,
  phone_e164 text not null,
  from_owner text,
  to_owner text not null,
  at timestamptz not null default now()
);
```

## Inbound webhook handling — logic the router MUST implement

When Meta sends a webhook to the router:

```
1. Extract sender's phone number (E.164).
2. If this is not a user message (delivery status, read receipt, etc.):
     - Existing logic. Optionally forward delivery callbacks too.
     - Done.
3. Look up owner of sender's phone in contact_ownership.
4. If owner == this app (router):
     - Existing logic (auto-reply, store, whatever).
5. Else if owner == 'reunion-2026' (or any external app):
     - FORWARD the webhook to that app's inbound URL.
     - DO NOT run any auto-reply for this message.
     - DO NOT process it as if it were addressed to this app.
6. Else (unowned):
     - Existing default logic (today's behavior, unchanged).
```

The forward in step 5 is:

```
POST {OWNER_INBOUND_URL}
Headers:
  Authorization: Bearer {INBOUND_FORWARD_SECRET}
  Content-Type: application/json
Body:
  {
    "owner": "reunion-2026",
    "sender_phone": "+919876543210",
    "received_at": "2026-05-28T10:42:00.000Z",
    "meta_payload": { ... original Meta webhook body, untouched ... }
  }
```

For Reunion 2026 specifically:
- `OWNER_INBOUND_URL` = `https://<reunion-app-host>/api/whatsapp/inbound`
- `INBOUND_FORWARD_SECRET` = a separate shared secret from the claim secret

The reunion app will respond 2xx if it accepted the message. If it 5xx's or times out, the router should log + retry later (best-effort; no strict guarantee needed for Phase 2).

## Configuration table on the router

Suggested per-owner config the router needs (env vars, config file, or DB rows — your call):

```
owners:
  reunion-2026:
    inbound_url: https://reunion-app-host/api/whatsapp/inbound
    inbound_secret: <INBOUND_FORWARD_SECRET>
```

Multiple owners can be configured the same way over time.

## Secrets

Two separate shared secrets, both stored in both backends' `.env`:

| Secret | Used by | Used for |
|---|---|---|
| `ROUTER_API_SECRET` | event-mgmt-app → router | Authenticating `POST /contacts/claim` calls |
| `INBOUND_FORWARD_SECRET` | router → event-mgmt-app | Authenticating forwarded inbound webhooks |

Pick long random strings (e.g., `openssl rand -hex 32`). Rotate per environment.

## What the event-mgmt-app will do

For context, the calling side:

1. After each sync from the master Sheet, for each participant with a phone where `whatsapp_claimed_at` is null in this app's DB:
   - POST `/contacts/claim` with the phone + participant metadata.
   - On 200, set `whatsapp_claimed_at = now` locally. If response included `previous_owner != null`, write an audit row noting the swap.
2. Send WhatsApp messages directly to the Meta Cloud API (NOT through the router). Outbound is independent.
3. Implement `POST /api/whatsapp/inbound` to receive forwarded webhooks from the router. Verifies `Authorization: Bearer {INBOUND_FORWARD_SECRET}`. Stores in the `communications` table with `direction='inbound'`.

## Minimal acceptance test

Once the router endpoints are live, an end-to-end smoke test:

1. From the event-mgmt-app, run a sync that includes at least one participant with a phone. Confirm `/contacts/claim` is called on the router, ownership is stored.
2. From that participant's WhatsApp account, send any message to the shared business number.
3. The router should forward it to the event-mgmt-app's inbound URL and stay silent. The event-mgmt-app's `/communications` page should show the inbound row.
4. From the event-mgmt-app, send an outbound WhatsApp message (via Meta Cloud API). Reply from the participant. Confirm reply also gets routed to the event-mgmt-app, not auto-replied by the router.

## What this spec does NOT cover (out of scope)

- The router's auto-reply / conversation logic for its own owned contacts — that's existing behavior, unchanged.
- Multi-owner / shared contacts — a phone is owned by exactly one app at a time. Phase 3+ may revisit.
- Migration of historical contacts — if there are reunion participants already in the router's existing contacts table with active conversations, plan a manual one-time backfill (call `/contacts/claim` from a script for each).
- Meta access tokens — the event-mgmt-app uses its own system-user token, separate from the router's. Token management is per-app.

## Open questions for the router implementer

- What's the auto-reply trigger today on the router for unknown senders? (Important to know what the "do not auto-reply" branch must skip.)
- Are delivery callbacks (sent / delivered / read) needed by the event-mgmt-app? If yes, the router should also forward those for messages sent by the event-mgmt-app. Out of scope for Phase 2 — can be added later.
- Is the router on a public URL the event-mgmt-app can reach from local dev (or do we need a tunnel)?
