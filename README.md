# Memento

Modular monolith for managing event participants across the engagement lifecycle. Built for **Reunion 2026** as the first tenant; designed to host additional events and modules without core rewrites.

Stack: Next.js 16 (App Router) · TypeScript · Supabase · Google Sheets/Forms/Gmail · Meta WhatsApp Cloud API (via a contact-ownership router; see [docs/whatsapp-router-spec.md](docs/whatsapp-router-spec.md)).

## Phase 0 status

What's wired:

- ✅ Next.js 16 + Tailwind v4 scaffold
- ✅ Supabase schema — core + reunion extensions ([db/](db/))
- ✅ Google auth — service account (default) + OAuth flow as fallback for Gmail ([app/api/auth/google/](app/api/auth/google/))
- ✅ Master sheet read + bidirectional contract scaffolding ([integrations/google-sheets/](integrations/google-sheets/))
- ✅ Sheet-to-DB sync with `sync_runs` audit ([app/api/sheets/sync/route.ts](app/api/sheets/sync/route.ts))
- ✅ Setup dashboard at `/` showing env, DB, OAuth, sync status
- ✅ Stubs: AiSensy WhatsApp client, Gmail send client

What's deliberately deferred to Phase 1+:

- Bidirectional sync with 5-minute organiser-edit grace window
- Participant list UI, lifecycle transitions, filtered views
- Bulk send + audit log UI
- Two-way WhatsApp inbox via webhooks

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

**Required for Phase 0** (red dots on the dashboard):

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` — from Supabase project → Settings → API keys → "Publishable / Secret API keys" tab (the legacy `anon` / `service_role` keys still work but are being phased out)
- `MASTER_SHEET_ID` — defaults to the reunion sheet; override per event

**Google auth** — pick one path:

- **Service account (recommended for Sheets/Forms):** Google Cloud Console → IAM → Service Accounts → Create → grant no IAM roles → on the new account, "Keys" → "Add key" → JSON. Save the file as `./service-account.json` at the project root (already gitignored). Set `GOOGLE_SERVICE_ACCOUNT_KEYFILE=./service-account.json`. **Then share the master Sheet with the service account's email** (Editor for write-back, Viewer for read-only). For Vercel/prod, use `GOOGLE_SERVICE_ACCOUNT_JSON_B64=$(base64 service-account.json)` instead.
- **OAuth (only needed for Gmail send — Phase 1+):** Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web). Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`. After running the app, visit `/api/auth/google` once to mint a refresh token; paste it into `GOOGLE_SHEETS_REFRESH_TOKEN`.

You can skip OAuth entirely for Phase 0.

**Auth / password gate** — required before exposing the app to the public internet:

- `ADMIN_PASSWORD` — the shared password the organisers use to sign in
- `AUTH_COOKIE_SECRET` — a long random string used to sign session cookies (`openssl rand -hex 32`)

If either is unset, the app is **open** (fine for local dev — but never deploy to Vercel like that). With both set, every page except `/login`, `/u/*` (unsubscribe), and the secret-protected webhook endpoints requires sign-in. See [proxy.ts](proxy.ts) for the gate logic.

### 3. Run database migrations

See [db/README.md](db/README.md). For Phase 0 the simplest path is pasting each file into the Supabase SQL Editor in order.

### 4. Start the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) — the setup dashboard shows what's wired and what's missing.

### 5. Run your first sync

```bash
curl -X POST http://localhost:3000/api/sheets/sync \
  -H "x-cron-secret: $CRON_SECRET"
```

(or omit the header if `CRON_SECRET` is unset). Check the dashboard — participant count and last sync run will update.

## Repository layout

```
app/                       Next.js App Router pages + route handlers
  api/auth/google/         OAuth initiate + callback
  api/health/              liveness probe
  api/sheets/sync/         master-sheet → DB sync (POST, cron-secured)
db/migrations/             plain SQL files, applied in order
integrations/
  google-sheets/           read master sheet, write tracking columns, sync orchestrator
  gmail/                   send-as-organiser client
  whatsapp/                AiSensy template-message client
lib/                       env, supabase client, google-auth, phone normalization, lifecycle enums
modules/
  participants/            repository + types (lifecycle = engagement axis)
  # phase 1+: communications, faculty, tnight, accommodation
```

## Source-of-truth model

- **Master invitee Sheet** (Google) is canonical for identity, batch/dorm/section, family. Organisers edit directly in Sheets without logging into the app.
- **Supabase** mirrors the Sheet and holds everything Sheets can't: communications, lifecycle history, audit, opt-outs, sync runs, nominations.
- **App writes back to the Sheet** only on the designated tracking columns (`Lifecycle Stage`, `Last Contacted Date`, `Form Submitted`, `Advance Paid`, etc.) — never on identity columns.

See [integrations/google-sheets/master-sheet.ts](integrations/google-sheets/master-sheet.ts) for the column map.

## Notes for contributors

- **Don't trust your Next.js training data.** This project is on Next.js 16 — `dynamic`/`revalidate` route segment config interacts with Cache Components, `params` is a Promise, etc. Read [node_modules/next/dist/docs/](node_modules/next/dist/docs/) before writing routes. See [AGENTS.md](AGENTS.md).
- The reunion event is the **first** tenant. Keep generic code event-agnostic — reunion-specific logic belongs in modules referenced by event type.
