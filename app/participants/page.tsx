import Link from 'next/link';
import {
  listParticipantsFiltered,
  listDistinctDormsAndSections,
  type ParticipantFilters,
} from '@/modules/participants/repository';
import { getCurrentEventId } from '@/lib/event-context';
import {
  LIFECYCLE_STAGES,
  LIFECYCLE_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_LABELS,
  type LifecycleStage,
  type PaymentStatus,
} from '@/lib/lifecycle';
import { LifecycleBadge, PaymentBadge } from '@/components/badges';
import { CopyButtons, type CopyRow } from '@/components/copy-buttons';

export const dynamic = 'force-dynamic';

type Search = Record<string, string | string[] | undefined>;

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function asStringList(v: string | string[] | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.flatMap((x) => x.split(','));
  return v.split(',').filter(Boolean);
}

function parseFilters(sp: Search): ParticipantFilters {
  const stages = asStringList(sp.stage).filter((s): s is LifecycleStage =>
    (LIFECYCLE_STAGES as readonly string[]).includes(s)
  );
  const payments = asStringList(sp.payment).filter((p): p is PaymentStatus =>
    (PAYMENT_STATUSES as readonly string[]).includes(p)
  );
  return {
    stages: stages.length ? stages : undefined,
    payments: payments.length ? payments : undefined,
    dorm: asString(sp.dorm) || undefined,
    section: asString(sp.section) || undefined,
    familyGroupId: asString(sp.family_group_id) || undefined,
    q: asString(sp.q) || undefined,
    hasEmail: asString(sp.has_email) === '1' || undefined,
    hasPhone: asString(sp.has_phone) === '1' || undefined,
    sort: asString(sp.sort) === 'last_contacted' ? 'last_contacted' : 'name',
  };
}

function buildSearchParams(sp: Search): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else if (v !== undefined) params.append(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const eventId = await getCurrentEventId();
  const [rows, distinct] = await Promise.all([
    listParticipantsFiltered(eventId, filters),
    listDistinctDormsAndSections(eventId),
  ]);

  const activeChips: Array<{ label: string; href: string }> = [];
  const removeKey = (key: string) => {
    const next: Search = { ...sp };
    delete next[key];
    return `/participants${buildSearchParams(next)}`;
  };
  if (filters.stages?.length)
    activeChips.push({
      label: `stage: ${filters.stages.map((s) => LIFECYCLE_LABELS[s]).join(', ')}`,
      href: removeKey('stage'),
    });
  if (filters.payments?.length)
    activeChips.push({
      label: `payment: ${filters.payments.map((s) => PAYMENT_LABELS[s]).join(', ')}`,
      href: removeKey('payment'),
    });
  if (filters.dorm)
    activeChips.push({ label: `dorm: ${filters.dorm}`, href: removeKey('dorm') });
  if (filters.section)
    activeChips.push({
      label: `section: ${filters.section}`,
      href: removeKey('section'),
    });
  if (filters.familyGroupId)
    activeChips.push({
      label: `family: ${filters.familyGroupId}`,
      href: removeKey('family_group_id'),
    });
  if (filters.q)
    activeChips.push({ label: `“${filters.q}”`, href: removeKey('q') });
  if (filters.hasEmail)
    activeChips.push({ label: 'has email', href: removeKey('has_email') });
  if (filters.hasPhone)
    activeChips.push({ label: 'has phone', href: removeKey('has_phone') });

  const copyRows: CopyRow[] = rows.map((p) => ({
    full_name: p.full_name,
    email: p.email,
    phone_e164: p.phone_e164,
    dorm: p.reunion?.dorm ?? null,
    dorm_number: p.reunion?.dorm_number ?? null,
    section: p.reunion?.section ?? null,
    family_group_id: p.family_group_id,
    lifecycle_stage: p.lifecycle_stage,
    payment_status: p.payment_status,
  }));

  const sendHref = `/participants/send${buildSearchParams(sp)}`;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Participants</h1>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium tabular-nums text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900">
              {rows.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {rows.length === 1 ? 'person' : 'people'} match these filters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={sendHref}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
              rows.length === 0
                ? 'cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-800'
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            }`}
            aria-disabled={rows.length === 0}
          >
            Send email
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <FilterBar
        filters={filters}
        availableDorms={distinct.dorms}
        availableSections={distinct.sections}
      />

      {activeChips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs uppercase tracking-wider text-zinc-500">
            Filtered:
          </span>
          {activeChips.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-700 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              title="Remove this filter"
            >
              {c.label} <span className="text-zinc-400">✕</span>
            </Link>
          ))}
          <Link
            href="/participants"
            className="ml-2 text-xs text-zinc-500 underline-offset-2 hover:underline"
          >
            clear all
          </Link>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <CopyButtons rows={copyRows} />
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 21a6 6 0 0 0-12 0" />
              <circle cx="12" cy="11" r="4" />
              <path d="m21 21-3-3" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            No participants match
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Try clearing some filters, or sync the master sheet.
          </p>
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/80">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Dorm / Section</th>
                <th className="px-4 py-3 font-medium">Family</th>
                <th className="px-4 py-3 font-medium">Lifecycle</th>
                <th className="px-4 py-3 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/participants/${p.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {p.full_name}
                    </Link>
                    {p.current_city && (
                      <div className="text-xs text-zinc-500">
                        {p.current_city}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {p.email && (
                      <div className="text-zinc-700 dark:text-zinc-300">
                        {p.email}
                      </div>
                    )}
                    {p.phone_e164 && (
                      <div className="font-mono text-zinc-500">
                        {p.phone_e164}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {p.reunion?.dorm ? (
                      <div>
                        {p.reunion.dorm}
                        {p.reunion.dorm_number && (
                          <span className="text-zinc-500">
                            {' '}
                            #{p.reunion.dorm_number}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                    {p.reunion?.section && (
                      <div className="text-zinc-500">
                        Section {p.reunion.section}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {p.family_group_id ? (
                      <Link
                        href={`/participants?family_group_id=${encodeURIComponent(p.family_group_id)}`}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                      >
                        {p.family_group_id}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <LifecycleBadge stage={p.lifecycle_stage} />
                  </td>
                  <td className="px-4 py-2.5">
                    <PaymentBadge status={p.payment_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </main>
  );
}

function FilterBar({
  filters,
  availableDorms,
  availableSections,
}: {
  filters: ParticipantFilters;
  availableDorms: string[];
  availableSections: string[];
}) {
  return (
    <form
      method="GET"
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-sm lg:col-span-2">
          <Label>Search</Label>
          <input
            type="text"
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="Name or email…"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="text-sm">
          <Label>Lifecycle</Label>
          <select
            name="stage"
            defaultValue={filters.stages?.[0] ?? ''}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Any</option>
            {LIFECYCLE_STAGES.map((s) => (
              <option key={s} value={s}>
                {LIFECYCLE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <Label>Payment</Label>
          <select
            name="payment"
            defaultValue={filters.payments?.[0] ?? ''}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Any</option>
            {PAYMENT_STATUSES.map((p) => (
              <option key={p} value={p}>
                {PAYMENT_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <Label>Dorm</Label>
          <select
            name="dorm"
            defaultValue={filters.dorm ?? ''}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Any</option>
            {availableDorms.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <Label>Section</Label>
          <select
            name="section"
            defaultValue={filters.section ?? ''}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Any</option>
            {availableSections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-1.5">
          <Label inline>Family</Label>
          <input
            type="text"
            name="family_group_id"
            defaultValue={filters.familyGroupId ?? ''}
            placeholder="F-0042"
            className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <Label inline>Sort</Label>
          <select
            name="sort"
            defaultValue={filters.sort ?? 'name'}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="name">Name</option>
            <option value="last_contacted">Last contacted</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="has_email"
            value="1"
            defaultChecked={!!filters.hasEmail}
          />
          <span>Has email</span>
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="has_phone"
            value="1"
            defaultChecked={!!filters.hasPhone}
          />
          <span>Has phone</span>
        </label>
        <div className="ml-auto flex gap-2">
          <a
            href="/participants"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Reset
          </a>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            Apply filters
          </button>
        </div>
      </div>
    </form>
  );
}

function Label({
  children,
  inline,
}: {
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <span
      className={`text-xs uppercase tracking-wider text-zinc-500 ${
        inline ? '' : 'block'
      }`}
    >
      {children}
    </span>
  );
}
