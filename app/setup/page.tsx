import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasServiceAccount, hasOAuthRefreshToken } from '@/lib/env';
import { SyncNowButton } from '@/components/sync-now-button';
import { ReconcileNowButton } from '@/components/reconcile-now-button';

export const dynamic = 'force-dynamic';

type DbStatus =
  | { ok: true; events: number; participants: number; lastSync: SyncRun | null }
  | { ok: false; error: string };

type SyncRun = {
  id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  summary: Record<string, unknown> | null;
  error: string | null;
};

type EnvCheck = {
  key: string;
  required: boolean;
  set: boolean;
  note?: string;
};

const REQUIRED_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'MASTER_SHEET_ID',
];

function checkEnv(): { required: EnvCheck[]; google: EnvCheck[]; other: EnvCheck[] } {
  const isSet = (k: string) => Boolean(process.env[k]);
  const required = REQUIRED_KEYS.map((key) => ({
    key,
    required: true,
    set: isSet(key),
  }));

  const saKeyfile = isSet('GOOGLE_SERVICE_ACCOUNT_KEYFILE');
  const saB64 = isSet('GOOGLE_SERVICE_ACCOUNT_JSON_B64');
  const google: EnvCheck[] = [
    {
      key: 'GOOGLE_SERVICE_ACCOUNT_KEYFILE',
      required: false,
      set: saKeyfile,
      note: 'recommended path for Sheets/Forms',
    },
    {
      key: 'GOOGLE_SERVICE_ACCOUNT_JSON_B64',
      required: false,
      set: saB64,
      note: 'alternative — base64 JSON for prod/Vercel',
    },
    { key: 'GOOGLE_CLIENT_ID', required: false, set: isSet('GOOGLE_CLIENT_ID'), note: 'OAuth — only for Gmail send (Phase 1+)' },
    { key: 'GOOGLE_CLIENT_SECRET', required: false, set: isSet('GOOGLE_CLIENT_SECRET') },
    { key: 'GOOGLE_SHEETS_REFRESH_TOKEN', required: false, set: isSet('GOOGLE_SHEETS_REFRESH_TOKEN') },
  ];

  const other: EnvCheck[] = [
    { key: 'FORM_RESPONSES_SHEET_ID', required: false, set: isSet('FORM_RESPONSES_SHEET_ID') },
    { key: 'AISENSY_API_KEY', required: false, set: isSet('AISENSY_API_KEY'), note: 'Phase 2' },
    { key: 'CRON_SECRET', required: false, set: isSet('CRON_SECRET') },
  ];

  return { required, google, other };
}

async function getDbStatus(): Promise<DbStatus> {
  try {
    const db = getSupabaseAdmin();
    const [{ count: events, error: e1 }, { count: participants, error: e2 }] =
      await Promise.all([
        db.from('events').select('*', { count: 'exact', head: true }),
        db.from('participants').select('*', { count: 'exact', head: true }),
      ]);
    if (e1) throw e1;
    if (e2) throw e2;

    const { data: lastSync, error: e3 } = await db
      .from('sync_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e3) throw e3;

    return {
      ok: true,
      events: events ?? 0,
      participants: participants ?? 0,
      lastSync: (lastSync as SyncRun | null) ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function Phase0Dashboard() {
  const env = checkEnv();
  const missingRequired = env.required.filter((c) => !c.set);
  const dbStatus = missingRequired.length === 0 ? await getDbStatus() : null;

  const sheetsReady = hasServiceAccount() || hasOAuthRefreshToken();
  const gmailReady = hasOAuthRefreshToken();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Memento · setup
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Setup dashboard
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Stack scaffold, Sheets sync skeleton, Supabase schema. Google auth via
          service account (Sheets/Forms) — OAuth only needed for Gmail send.
        </p>
      </header>

      <Section title="1. Environment — required">
        <EnvList items={env.required} />
        {missingRequired.length > 0 && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
            Copy <code>.env.example</code> to <code>.env.local</code> and fill
            in the keys above.
          </p>
        )}
      </Section>

      <Section title="2. Google auth">
        <div className="mb-3 flex flex-col gap-1 text-sm">
          <StatusLine
            label="Sheets / Forms read+write"
            ok={sheetsReady}
            via={
              hasServiceAccount()
                ? 'via service account'
                : hasOAuthRefreshToken()
                  ? 'via OAuth (fallback)'
                  : 'not configured'
            }
          />
          <StatusLine
            label="Gmail send"
            ok={gmailReady}
            via={
              gmailReady
                ? 'via OAuth refresh token'
                : 'OAuth not set up (Phase 1+ feature)'
            }
            warnIfMissing
          />
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">
            Set one (any one) →
          </summary>
          <EnvList items={env.google} />
          {!hasServiceAccount() && (
            <p className="mt-3 text-xs text-zinc-500">
              Service account is recommended. Create at Google Cloud → IAM →
              Service Accounts → Keys → JSON. Save as{' '}
              <code>./service-account.json</code> (gitignored). Then share the
              master Sheet with that account&apos;s email (Editor for
              write-back, Viewer for read-only).
            </p>
          )}
          {!gmailReady && (
            <p className="mt-3 text-xs text-zinc-500">
              For Gmail send (Phase 1+): set <code>GOOGLE_CLIENT_ID</code>/
              <code>SECRET</code>, click below, paste returned{' '}
              <code>refresh_token</code> into{' '}
              <code>GOOGLE_SHEETS_REFRESH_TOKEN</code>.
              {process.env.GOOGLE_CLIENT_ID && (
                <>
                  {' '}
                  <a
                    href="/api/auth/google"
                    className="font-medium text-zinc-900 underline dark:text-zinc-100"
                  >
                    Connect Google →
                  </a>
                </>
              )}
            </p>
          )}
        </details>
      </Section>

      <Section title="3. Database">
        {missingRequired.length > 0 ? (
          <p className="text-sm text-zinc-500">
            Skipped — Supabase env not configured yet.
          </p>
        ) : dbStatus?.ok ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-end gap-6">
              <Stat label="Events" value={dbStatus.events} />
              <Stat label="Participants" value={dbStatus.participants} />
              {dbStatus.participants > 0 && (
                <Link
                  href="/participants"
                  className="ml-auto rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  View participants →
                </Link>
              )}
            </div>
            {dbStatus.events === 0 && (
              <p className="text-amber-700 dark:text-amber-400">
                Run migrations: see{' '}
                <code>db/README.md</code>.
              </p>
            )}
            <LastSyncCard run={dbStatus.lastSync} />
          </div>
        ) : (
          <p className="text-sm text-red-700 dark:text-red-400">
            DB error: {dbStatus?.error}
          </p>
        )}
      </Section>

      <Section title="4. Sheets sync">
        <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">
          Reads the master sheet, upserts participants, and reconciles tracking
          columns with the 5-min grace window.
        </p>
        {missingRequired.length === 0 ? (
          <div className="space-y-3">
            <SyncNowButton />
            <ReconcileNowButton />
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Configure Supabase env first.
          </p>
        )}
        <details className="mt-3 text-xs text-zinc-500">
          <summary className="cursor-pointer">curl equivalent</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-3 dark:bg-zinc-900">
            {`curl -X POST http://localhost:3000/api/sheets/sync \\
  -H "x-cron-secret: $CRON_SECRET"`}
          </pre>
        </details>
      </Section>

      <Section title="5. Other env">
        <EnvList items={env.other} />
      </Section>

      <Section title="6. WhatsApp (AiSensy)">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Template approval is the long-lead Phase 0 task. Start it in the
          AiSensy dashboard — Meta approval typically takes 1-3 business days.
        </p>
      </Section>

      <footer className="mt-12 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
        Phase 0 status. Phase 1 brings the participant list UI, lifecycle
        management, and email send.
      </footer>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function EnvList({ items }: { items: EnvCheck[] }) {
  return (
    <ul className="space-y-1 text-sm font-mono">
      {items.map((c) => (
        <li key={c.key} className="flex items-center gap-3">
          <StatusDot ok={c.set} warn={!c.set && !c.required} />
          <span className={c.set ? '' : 'text-zinc-500'}>{c.key}</span>
          {c.note && (
            <span className="text-xs text-zinc-500 not-italic">— {c.note}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function StatusLine({
  label,
  ok,
  via,
  warnIfMissing,
}: {
  label: string;
  ok: boolean;
  via: string;
  warnIfMissing?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <StatusDot ok={ok} warn={!ok && warnIfMissing} />
      <span className="font-medium">{label}</span>
      <span className="text-xs text-zinc-500">{via}</span>
    </div>
  );
}

function StatusDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  const cls = ok
    ? 'bg-green-500'
    : warn
      ? 'bg-zinc-300 dark:bg-zinc-700'
      : 'bg-red-500';
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

function LastSyncCard({ run }: { run: SyncRun | null }) {
  if (!run) {
    return (
      <div className="text-zinc-600 dark:text-zinc-400">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">Last sync run</p>
        <p className="text-xs">No syncs yet.</p>
      </div>
    );
  }
  const s = run.summary as Record<string, unknown> | null;
  const hasInvalid = s && typeof s.invalidValues === 'object' && s.invalidValues
    ? Object.keys(s.invalidValues as Record<string, number>).length > 0
    : false;
  const num = (key: string) => (s && typeof s[key] === 'number' ? (s[key] as number) : 0);

  return (
    <div className="space-y-2 text-zinc-700 dark:text-zinc-300">
      <p className="font-medium text-zinc-900 dark:text-zinc-100">Last sync run</p>
      <p className="font-mono text-xs">
        {run.source} · {run.status} ·{' '}
        {new Date(run.started_at).toLocaleString()}
      </p>
      {run.status === 'failed' && run.error && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {run.error}
        </p>
      )}
      {s && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          <Stat2 label="Read" value={num('rowsRead')} />
          <Stat2 label="Imported" value={num('rowsImported')} />
          <Stat2 label="Drift" value={num('rowsWithDrift')} warn={num('rowsWithDrift') > 0} />
          <Stat2 label="Cols imported" value={num('trackingColumnsImported')} />
          <Stat2 label="Inserted" value={num('inserted')} />
          <Stat2 label="Updated" value={num('updated')} />
          <Stat2 label="Skipped" value={num('rowsSkipped')} warn={num('rowsSkipped') > 0} />
          <Stat2 label="Baseline init" value={num('rowsInitializedBaseline')} />
        </div>
      )}
      {hasInvalid && s && (
        <div className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <span className="font-medium">Invalid values:</span>{' '}
          {Object.entries(s.invalidValues as Record<string, number>)
            .map(([k, v]) => `${k} ×${v}`)
            .join(', ')}
        </div>
      )}
    </div>
  );
}

function Stat2({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div>
      <span
        className={`font-mono ${
          warn && value > 0
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-zinc-900 dark:text-zinc-100'
        }`}
      >
        {value}
      </span>
      <span className="ml-1 text-zinc-500">{label}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </div>
  );
}
