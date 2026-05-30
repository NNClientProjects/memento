import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  hasServiceAccount,
  hasOAuthRefreshToken,
  hasWhatsAppRouter,
  hasMetaWhatsApp,
} from '@/lib/env';
import { authConfigured } from '@/lib/auth-cookie';
import { SyncNowButton } from '@/components/sync-now-button';
import { ReconcileNowButton } from '@/components/reconcile-now-button';

export const dynamic = 'force-dynamic';

type SyncRun = {
  id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  summary: Record<string, unknown> | null;
  error: string | null;
};

const REQUIRED_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'MASTER_SHEET_ID',
] as const;

const OPTIONAL_KEYS = [
  'GOOGLE_SERVICE_ACCOUNT_KEYFILE',
  'GOOGLE_SERVICE_ACCOUNT_JSON_B64',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_SHEETS_REFRESH_TOKEN',
  'FORM_RESPONSES_SHEET_ID',
  'CRON_SECRET',
  'OPT_OUT_SECRET',
  'APP_BASE_URL',
  'ROUTER_BASE_URL',
  'ROUTER_API_SECRET',
  'INBOUND_FORWARD_SECRET',
  'META_WHATSAPP_PHONE_NUMBER_ID',
  'META_WHATSAPP_WABA_ID',
  'META_WHATSAPP_ACCESS_TOKEN',
  'ADMIN_PASSWORD',
  'AUTH_COOKIE_SECRET',
] as const;

type DbStatus =
  | { ok: true; events: number; participants: number; lastSync: SyncRun | null }
  | { ok: false; error: string };

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

type StatusItem = {
  label: string;
  state: 'ok' | 'optional' | 'error';
  detail?: string;
};

export default async function SetupPage() {
  const isSet = (k: string) => Boolean(process.env[k]);
  const missingRequired = REQUIRED_KEYS.filter((k) => !isSet(k));
  const dbStatus = missingRequired.length === 0 ? await getDbStatus() : null;

  const status: StatusItem[] = [
    {
      label: 'Database',
      state:
        missingRequired.length > 0
          ? 'error'
          : dbStatus?.ok
            ? 'ok'
            : 'error',
      detail: dbStatus?.ok
        ? `${dbStatus.events} event${dbStatus.events === 1 ? '' : 's'} · ${dbStatus.participants} participants`
        : !dbStatus
          ? `missing: ${missingRequired.join(', ')}`
          : dbStatus.error,
    },
    {
      label: 'Sheets (read + write)',
      state: hasServiceAccount()
        ? 'ok'
        : hasOAuthRefreshToken()
          ? 'ok'
          : 'error',
      detail: hasServiceAccount()
        ? 'via service account'
        : hasOAuthRefreshToken()
          ? 'via OAuth refresh token'
          : 'no service account or OAuth token',
    },
    {
      label: 'Email (Gmail send)',
      state: hasOAuthRefreshToken() ? 'ok' : 'optional',
      detail: hasOAuthRefreshToken()
        ? 'via OAuth refresh token'
        : 'not configured · sending email disabled',
    },
    {
      label: 'WhatsApp router',
      state: hasWhatsAppRouter() ? 'ok' : 'optional',
      detail: hasWhatsAppRouter()
        ? (process.env.ROUTER_BASE_URL ?? 'configured')
        : 'not configured · contact claims and inbox disabled',
    },
    {
      label: 'WhatsApp Cloud API (outbound)',
      state: hasMetaWhatsApp() ? 'ok' : 'optional',
      detail: hasMetaWhatsApp()
        ? 'Meta credentials set'
        : 'not configured · bulk WhatsApp send unavailable',
    },
    {
      label: 'Login gate',
      state: authConfigured() ? 'ok' : 'optional',
      detail: authConfigured()
        ? 'enabled · shared password'
        : 'disabled · all pages public',
    },
  ];

  const hasErrors = status.some((s) => s.state === 'error');

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Setup</h1>
        <p className="mt-1 text-sm text-zinc-500">
          App health and admin actions.
        </p>
      </header>

      <section className="mb-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {status.map((s) => (
            <li
              key={s.label}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <StatusDot state={s.state} />
              <span className="font-medium">{s.label}</span>
              {s.detail && (
                <span className="ml-auto truncate text-xs text-zinc-500">
                  {s.detail}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {missingRequired.length === 0 ? (
        <section className="mb-5 space-y-3">
          <SyncNowButton />
          <ReconcileNowButton />
          <Link
            href="/stages"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Manage lifecycle stages →
          </Link>
        </section>
      ) : (
        <section className="mb-5 rounded-md bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-medium">Database not configured</p>
          <p className="mt-1 text-xs">
            Copy <code>.env.example</code> to <code>.env</code> and set:{' '}
            <span className="font-mono">{missingRequired.join(', ')}</span>.
            Then restart the dev server (or redeploy).
          </p>
        </section>
      )}

      {dbStatus?.ok && (
        <section className="mb-5">
          <LastSyncCard run={dbStatus.lastSync} />
        </section>
      )}

      <details className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <summary className="cursor-pointer px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
          Environment variable status {hasErrors && '(some required keys missing)'}
        </summary>
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Required
          </h3>
          <EnvList keys={REQUIRED_KEYS} required />
          <h3 className="mt-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Optional
          </h3>
          <EnvList keys={OPTIONAL_KEYS} />
        </div>
      </details>
    </main>
  );
}

function StatusDot({ state }: { state: 'ok' | 'optional' | 'error' }) {
  const cls =
    state === 'ok'
      ? 'bg-green-500'
      : state === 'optional'
        ? 'bg-zinc-300 dark:bg-zinc-700'
        : 'bg-red-500';
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function EnvList({
  keys,
  required,
}: {
  keys: readonly string[];
  required?: boolean;
}) {
  return (
    <ul className="mt-1 space-y-0.5 font-mono text-xs">
      {keys.map((key) => {
        const set = Boolean(process.env[key]);
        return (
          <li key={key} className="flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                set
                  ? 'bg-green-500'
                  : required
                    ? 'bg-red-500'
                    : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            />
            <span className={set ? '' : 'text-zinc-500'}>{key}</span>
          </li>
        );
      })}
    </ul>
  );
}

function LastSyncCard({ run }: { run: SyncRun | null }) {
  if (!run) {
    return (
      <div className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
        No syncs yet. Click <span className="font-medium">Sync now</span> above.
      </div>
    );
  }
  const s = run.summary as Record<string, unknown> | null;
  const num = (key: string) =>
    s && typeof s[key] === 'number' ? (s[key] as number) : 0;
  const hasInvalid =
    s && typeof s.invalidValues === 'object' && s.invalidValues
      ? Object.keys(s.invalidValues as Record<string, number>).length > 0
      : false;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-baseline justify-between gap-2 border-b border-zinc-200 bg-zinc-50/60 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
        <span className="text-sm font-medium">Last sync</span>
        <span className="font-mono text-xs text-zinc-500">
          {new Date(run.started_at).toLocaleString()} · {run.status}
        </span>
      </div>
      <div className="px-4 py-3 text-sm">
        {run.status === 'failed' && run.error && (
          <p className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
            {run.error}
          </p>
        )}
        {s && (
          <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs sm:grid-cols-6">
            <Stat label="Read" value={num('rowsRead')} />
            <Stat label="Imported" value={num('rowsImported')} />
            <Stat label="New" value={num('inserted')} />
            <Stat label="Updated" value={num('updated')} />
            <Stat
              label="From sheet"
              value={num('trackingColumnsImported')}
              warn={num('rowsWithDrift') > 0}
            />
            <Stat label="Skipped" value={num('rowsSkipped')} warn={num('rowsSkipped') > 0} />
          </div>
        )}
        {hasInvalid && s && (
          <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <span className="font-medium">Invalid values in sheet:</span>{' '}
            {Object.entries(s.invalidValues as Record<string, number>)
              .map(([k, v]) => `${k} ×${v}`)
              .join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
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
        className={`font-mono text-sm ${
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
