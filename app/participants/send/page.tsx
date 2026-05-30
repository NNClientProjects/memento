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
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back to participants
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Bulk email</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {dedupedRecipients.length} recipient
          {dedupedRecipients.length === 1 ? '' : 's'}
          {skippedNoEmail > 0 && (
            <> · {skippedNoEmail} excluded (no email)</>
          )}
          {skippedOptOut > 0 && (
            <> · {skippedOptOut} excluded (opted out)</>
          )}
          {skippedDuplicates > 0 && (
            <> · {skippedDuplicates} de-duped by email</>
          )}
        </p>
      </header>

      {dedupedRecipients.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No recipients match (none with email). Adjust the filter.
        </p>
      ) : (
        <>
          <section className="mb-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <h2 className="border-b border-zinc-200 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
              Recipients
            </h2>
            <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-900">
              {dedupedRecipients.map((r) => (
                <li key={r.id} className="flex items-baseline gap-3 px-4 py-1.5 text-sm">
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
            <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              Phase 1 cap is {MAX_RECIPIENTS_PER_SEND} recipients per send.
              Apply a tighter filter to send to fewer than that, or send in
              batches (sort + filter to slice).
            </div>
          )}

          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
            <h2 className="border-b border-zinc-200 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
              Send
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
