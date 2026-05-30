import Link from 'next/link';
import {
  listParticipantsFiltered,
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

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const eventId = await getCurrentEventId();
  const rows = await listParticipantsFiltered(eventId, filters);

  const activeFilterCount = [
    filters.stages?.length,
    filters.payments?.length,
    filters.dorm ? 1 : 0,
    filters.section ? 1 : 0,
    filters.familyGroupId ? 1 : 0,
    filters.q ? 1 : 0,
    filters.hasEmail ? 1 : 0,
    filters.hasPhone ? 1 : 0,
  ]
    .filter((n): n is number => typeof n === 'number')
    .reduce((a, b) => a + b, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Participants</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {rows.length} shown
            {activeFilterCount > 0 && (
              <>
                {' · '}
                <Link
                  href="/participants"
                  className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  clear filters
                </Link>
              </>
            )}
          </p>
        </div>
        {rows.length > 0 && (
          <Link
            href={`/participants/send${
              Object.keys(sp).length > 0
                ? `?${new URLSearchParams(
                    Object.entries(sp).flatMap(([k, v]) =>
                      Array.isArray(v)
                        ? v.map((x) => [k, x] as [string, string])
                        : v !== undefined
                          ? [[k, v] as [string, string]]
                          : []
                    )
                  )}`
                : ''
            }`}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Send email →
          </Link>
        )}
      </header>

      <FilterBar filters={filters} />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No participants match. Try clearing filters, or run a sheet sync.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Dorm / Section</th>
                <th className="px-4 py-2 font-medium">Family</th>
                <th className="px-4 py-2 font-medium">Lifecycle</th>
                <th className="px-4 py-2 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/participants/${p.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {p.full_name}
                    </Link>
                    {p.current_city && (
                      <div className="text-xs text-zinc-500">{p.current_city}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {p.email && <div className="text-zinc-700 dark:text-zinc-300">{p.email}</div>}
                    {p.phone_e164 && (
                      <div className="font-mono text-zinc-500">{p.phone_e164}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {p.reunion?.dorm ? (
                      <div>
                        {p.reunion.dorm}
                        {p.reunion.dorm_number && (
                          <span className="text-zinc-500"> #{p.reunion.dorm_number}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                    {p.reunion?.section && (
                      <div className="text-zinc-500">Section {p.reunion.section}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
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
                  <td className="px-4 py-2">
                    <LifecycleBadge stage={p.lifecycle_stage} />
                  </td>
                  <td className="px-4 py-2">
                    <PaymentBadge status={p.payment_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function FilterBar({ filters }: { filters: ParticipantFilters }) {
  return (
    <form
      method="GET"
      className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30 sm:grid-cols-2 lg:grid-cols-4"
    >
      <label className="col-span-full text-sm sm:col-span-2">
        <span className="block text-xs uppercase tracking-wider text-zinc-500">Search</span>
        <input
          type="text"
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="Name or email…"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="text-sm">
        <span className="block text-xs uppercase tracking-wider text-zinc-500">Lifecycle</span>
        <select
          name="stage"
          defaultValue={filters.stages?.[0] ?? ''}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
        <span className="block text-xs uppercase tracking-wider text-zinc-500">Payment</span>
        <select
          name="payment"
          defaultValue={filters.payments?.[0] ?? ''}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
        <span className="block text-xs uppercase tracking-wider text-zinc-500">Dorm</span>
        <input
          type="text"
          name="dorm"
          defaultValue={filters.dorm ?? ''}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="text-sm">
        <span className="block text-xs uppercase tracking-wider text-zinc-500">Section</span>
        <input
          type="text"
          name="section"
          defaultValue={filters.section ?? ''}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="text-sm">
        <span className="block text-xs uppercase tracking-wider text-zinc-500">Family</span>
        <input
          type="text"
          name="family_group_id"
          defaultValue={filters.familyGroupId ?? ''}
          placeholder="F-0042"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="text-sm">
        <span className="block text-xs uppercase tracking-wider text-zinc-500">Sort</span>
        <select
          name="sort"
          defaultValue={filters.sort ?? 'name'}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="name">Name</option>
          <option value="last_contacted">Last contacted</option>
        </select>
      </label>

      <div className="col-span-full flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="has_email"
            value="1"
            defaultChecked={!!filters.hasEmail}
          />
          Has email
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="has_phone"
            value="1"
            defaultChecked={!!filters.hasPhone}
          />
          Has phone
        </label>
        <div className="ml-auto flex gap-2">
          <Link
            href="/participants"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Reset
          </Link>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Apply
          </button>
        </div>
      </div>
    </form>
  );
}
