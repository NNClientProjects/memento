# Database migrations

Plain SQL files applied in numeric order. Phase 0 keeps the runner simple — we don't ship a custom migrator yet.

## Apply migrations

### Option A — Supabase SQL Editor (recommended for Phase 0)

1. Open the Supabase project → **SQL Editor**.
2. Paste each file in order, run, and verify no errors:
   - [0001_core_schema.sql](migrations/0001_core_schema.sql) — event-agnostic core (events, participants, lifecycle, comms, audit, sync_runs)
   - [0002_reunion_module.sql](migrations/0002_reunion_module.sql) — reunion-specific extensions (dorm, T-Night, faculty, form responses)
   - [0003_seed_reunion_event.sql](migrations/0003_seed_reunion_event.sql) — seeds the `reunion-2026` event row; idempotent (on-conflict update)

### Option B — supabase CLI

If you have the Supabase CLI installed and the project linked:

```bash
supabase db push          # applies pending local migrations
# or, run a single file directly:
psql "$SUPABASE_DB_URL" -f db/migrations/0001_core_schema.sql
```

## Conventions

- Filenames: `NNNN_short_description.sql`, monotonically increasing.
- Each migration is **idempotent where possible** (`create extension if not exists`, `on conflict do update`).
- New columns and tables only — no destructive changes in Phase 0/1. Renames go through add-new + backfill + drop-old in separate migrations.
- Per-event modules live in their own migrations after `0002_reunion_module.sql`.

## Schema notes

- `participants` has unique `(event_id, email)` but email is nullable. Phone-only rows are allowed; uniqueness on phone is enforced at the application layer in [modules/participants/repository.ts](../modules/participants/repository.ts).
- `sync_runs` is the audit trail for every Sheets → DB sync. Status is one of `running`, `completed`, `failed`.
- Triggers `set_updated_at()` are wired on `events`, `participants`, `templates`, `faculty`.
