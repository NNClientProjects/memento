import Link from 'next/link';
import {
  listParticipantsFiltered,
  type ParticipantFilters,
} from '@/modules/participants/repository';
import { listTemplates } from '@/modules/communications/repository';
import { getOptedOutSet } from '@/modules/communications/opt-out';
import { listStages } from '@/modules/stages/repository';
import type { Stage } from '@/modules/stages/types';
import { getCurrentEventId } from '@/lib/event-context';
import { PAYMENT_STATUSES, type PaymentStatus } from '@/lib/lifecycle';
import { MAX_RECIPIENTS_PER_SEND } from '@/modules/communications/send';
import { BulkSendForm } from '@/components/bulk-send-form';

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

function parseFilters(sp: Search, stages: Stage[]): ParticipantFilters {
  const slugs = asStringList(sp.stage);
  const stageIds = slugs
    .map((slug) => stages.find((s) => s.slug === slug)?.id)
    .filter((id): id is string => !!id);
  const payments = asStringList(sp.payment).filter((p): p is PaymentStatus =>
    (PAYMENT_STATUSES as readonly string[]).includes(p)
  );
  return {
    stageIds: stageIds.length ? stageIds : undefined,
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

export default async function BulkSendPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const eventId = await getCurrentEventId();
  const stages = await listStages(eventId);
  const filters = parseFilters(sp, stages);
  const [rows, templates, emailOptedOut] = await Promise.all([
    listParticipantsFiltered(eventId, filters),
    listTemplates(eventId, 'email'),
    getOptedOutSet(eventId, 'email'),
  ]);

  const recipientsWithEmail = rows.filter((r) => r.email);
  const skippedNoEmail = rows.length - recipientsWithEmail.length;

  const recipients = recipientsWithEmail.filter((r) => !emailOptedOut.has(r.id));
  const skippedOptOut = recipientsWithEmail.length - recipients.length;

  const seen = new Set<string>();
  const dedupedRecipients = recipients.filter((r) => {
    if (!r.email) return false;
    if (seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });
  const skippedDuplicates = recipients.length - dedupedRecipients.length;

  const filterQuery = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => filterQuery.append(k, x));
    else if (v !== undefined) filterQuery.append(k, v);
  }
  const backHref = `/participants${filterQuery.toString() ? `?${filterQuery}` : ''}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <span aria-hidden="true">←</span> Back to participants
        </Link>
      </nav>

      <header className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Bulk email</h1>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium tabular-nums text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900">
            {dedupedRecipients.length}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          recipient{dedupedRecipients.length === 1 ? '' : 's'}
        </p>
        {(skippedNoEmail > 0 || skippedOptOut > 0 || skippedDuplicates > 0) && (
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {skippedNoEmail > 0 && (
              <ExclusionPill>{skippedNoEmail} no email</ExclusionPill>
            )}
            {skippedOptOut > 0 && (
              <ExclusionPill>{skippedOptOut} opted out</ExclusionPill>
            )}
            {skippedDuplicates > 0 && (
              <ExclusionPill>{skippedDuplicates} duplicate emails</ExclusionPill>
            )}
          </ul>
        )}
      </header>

      {dedupedRecipients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m4 8 8 5 8-5" />
              <rect width="20" height="14" x="2" y="6" rx="2" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            No-one to email
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Loosen the filter on{' '}
            <Link href={backHref} className="underline">
              Participants
            </Link>{' '}
            and try again.
          </p>
        </div>
      ) : (
        <>
          <section className="mb-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="border-b border-zinc-200 bg-zinc-50/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              Recipients
            </h2>
            <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-900">
              {dedupedRecipients.map((r) => (
                <li
                  key={r.id}
                  className="flex items-baseline gap-3 px-4 py-2 text-sm"
                >
                  <Link
                    href={`/participants/${r.id}`}
                    className="font-medium hover:underline"
                  >
                    {r.full_name}
                  </Link>
                  <span className="font-mono text-xs text-zinc-500">
                    {r.email}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {dedupedRecipients.length > MAX_RECIPIENTS_PER_SEND && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="font-medium">
                Over the per-send cap ({MAX_RECIPIENTS_PER_SEND})
              </p>
              <p className="mt-1 text-xs">
                Apply a tighter filter to send to fewer at a time, or send in
                batches.
              </p>
            </div>
          )}

          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="border-b border-zinc-200 bg-zinc-50/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              Pick a template and send
            </h2>
            <div className="p-4">
              <BulkSendForm
                recipientIds={dedupedRecipients.map((r) => r.id)}
                templates={templates}
                tooMany={dedupedRecipients.length > MAX_RECIPIENTS_PER_SEND}
              />
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function ExclusionPill({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      {children}
    </li>
  );
}
