import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getParticipantById } from '@/modules/participants/repository';
import {
  getLifecycleHistory,
  listFamilyMembers,
  listFamilyCandidates,
} from '@/modules/participants/services';
import {
  changeLifecycleAction,
  groupAsFamilyAction,
  unlinkFamilyAction,
} from '@/modules/participants/actions';
import {
  listTemplates,
  participantCommunications,
} from '@/modules/communications/repository';
import { participantMergeContext } from '@/modules/communications/send';
import { listOptOutsForParticipant } from '@/modules/communications/opt-out';
import { getCurrentEvent } from '@/lib/event-context';
import { SendEmailPanel } from '@/components/send-email-panel';
import { WhatsAppPanel } from '@/components/whatsapp-panel';
import { OptOutToggle } from '@/components/opt-out-toggle';
import {
  LIFECYCLE_STAGES,
  LIFECYCLE_LABELS,
  COMM_CHANNELS,
} from '@/lib/lifecycle';
import { isInGraceWindow, GRACE_WINDOW_MS } from '@/lib/sheet-grace';
import { LifecycleBadge, PaymentBadge } from '@/components/badges';
import { ActionForm } from '@/components/action-form';

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getCurrentEvent();
  const eventId = event.id;
  const p = await getParticipantById(eventId, id);
  if (!p) notFound();

  const [
    history,
    familyMembers,
    familyCandidates,
    emailTemplates,
    waTemplates,
    comms,
    optOuts,
  ] = await Promise.all([
    getLifecycleHistory(p.id),
    p.family_group_id
      ? listFamilyMembers(eventId, p.family_group_id)
      : Promise.resolve([]),
    p.family_group_id ? Promise.resolve([]) : listFamilyCandidates(eventId, p.id),
    listTemplates(eventId, 'email'),
    listTemplates(eventId, 'whatsapp'),
    participantCommunications(p.id),
    listOptOutsForParticipant(p.id),
  ]);

  const mergeContext = participantMergeContext(p, event.name);
  const emailOptOut = optOuts.find((o) => o.channel === 'email') ?? null;
  const waOptOut = optOuts.find((o) => o.channel === 'whatsapp') ?? null;

  const sheetId = process.env.MASTER_SHEET_ID;
  const sheetRowLink =
    sheetId && p.sheet_row_number
      ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=0&range=A${p.sheet_row_number}`
      : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/participants" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Participants
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{p.full_name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <LifecycleBadge stage={p.lifecycle_stage} />
          <PaymentBadge status={p.payment_status} />
          {p.family_group_id && (
            <Link
              href={`/participants?family_group_id=${encodeURIComponent(p.family_group_id)}`}
              className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              {p.family_group_id}
            </Link>
          )}
        </div>
      </header>

      {isInGraceWindow(p.sheet_edit_detected_at) && p.sheet_edit_detected_at && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-300">
            Organiser-edit grace window active
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-400">
            Sheet was edited at{' '}
            <span className="font-mono">
              {new Date(p.sheet_edit_detected_at).toLocaleTimeString()}
            </span>
            . App writebacks for this row are paused until{' '}
            <span className="font-mono">
              {new Date(
                new Date(p.sheet_edit_detected_at).getTime() + GRACE_WINDOW_MS
              ).toLocaleTimeString()}
            </span>
            . Lifecycle/family changes in the app will update the DB but not the
            Sheet until grace expires.
          </p>
        </div>
      )}

      <Card title="Lifecycle">
        <div className="px-4 py-3">
          <ActionForm action={changeLifecycleAction} className="space-y-3">
            <input type="hidden" name="participantId" value={p.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="block text-xs uppercase tracking-wider text-zinc-500">
                  New stage
                </span>
                <select
                  name="newStage"
                  defaultValue={p.lifecycle_stage}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  {LIFECYCLE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {LIFECYCLE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 text-sm">
                <input
                  type="checkbox"
                  name="setLastContacted"
                  value="1"
                  className="mb-2"
                />
                <span className="mb-1">Mark as contacted just now</span>
              </label>
            </div>
            <label className="block text-sm">
              <span className="block text-xs uppercase tracking-wider text-zinc-500">
                Reason (optional)
              </span>
              <textarea
                name="reason"
                rows={2}
                placeholder="e.g. spoke on call, said yes"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Update lifecycle
            </button>
          </ActionForm>
        </div>
        {history.length > 0 && (
          <>
            <h3 className="border-t border-zinc-200 px-4 py-2 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
              Recent transitions
            </h3>
            <ol className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-baseline gap-2 px-4 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-zinc-500">
                    {new Date(h.changed_at).toLocaleString()}
                  </span>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {h.from_stage
                      ? `${LIFECYCLE_LABELS[h.from_stage]} → `
                      : ''}
                    <span className="font-medium">
                      {LIFECYCLE_LABELS[h.to_stage]}
                    </span>
                  </span>
                  {h.reason && (
                    <span className="text-zinc-500">— {h.reason}</span>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </Card>

      <Card title="Family">
        {p.family_group_id ? (
          <div className="space-y-3 px-4 py-3">
            <p className="text-sm">
              Member of{' '}
              <Link
                href={`/participants?family_group_id=${encodeURIComponent(p.family_group_id)}`}
                className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                {p.family_group_id}
              </Link>{' '}
              with {familyMembers.length - 1} other
              {familyMembers.length - 1 === 1 ? '' : 's'}:
            </p>
            <ul className="space-y-1 text-sm">
              {familyMembers
                .filter((m) => m.id !== p.id)
                .map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/participants/${m.id}`}
                      className="text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {m.full_name}
                    </Link>
                    {m.email && (
                      <span className="ml-2 font-mono text-xs text-zinc-500">
                        {m.email}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
            <ActionForm action={unlinkFamilyAction}>
              <input type="hidden" name="participantId" value={p.id} />
              <button
                type="submit"
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Remove this person from family
              </button>
            </ActionForm>
          </div>
        ) : (
          <div className="space-y-3 px-4 py-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Not in a family group yet. Pick one or more other participants to
              group together — they&apos;ll share a tag for room allocation.
            </p>
            {familyCandidates.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No candidates available (everyone else is already in a family
                group).
              </p>
            ) : (
              <details className="text-sm">
                <summary className="cursor-pointer rounded-md bg-zinc-100 px-3 py-1.5 font-medium hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                  Group as family ({familyCandidates.length} candidate
                  {familyCandidates.length === 1 ? '' : 's'})
                </summary>
                <ActionForm action={groupAsFamilyAction} className="mt-3 space-y-3">
                  <input type="hidden" name="primaryId" value={p.id} />
                  <div className="max-h-72 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
                    {familyCandidates.map((c) => (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-start gap-2 border-b border-zinc-100 px-3 py-1.5 text-sm last:border-b-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/50"
                      >
                        <input
                          type="checkbox"
                          name="memberIds"
                          value={c.id}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium">{c.full_name}</div>
                          <div className="text-xs text-zinc-500">
                            {c.email ?? c.phone_e164 ?? '—'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    Confirm family group
                  </button>
                </ActionForm>
              </details>
            )}
          </div>
        )}
      </Card>

      <Card title="Opt-out status">
        <div className="space-y-3 px-4 py-3">
          <OptOutToggle
            participantId={p.id}
            channel="email"
            optedOut={!!emailOptOut}
            optedOutAt={emailOptOut?.opted_out_at ?? null}
          />
          <OptOutToggle
            participantId={p.id}
            channel="whatsapp"
            optedOut={!!waOptOut}
            optedOutAt={waOptOut?.opted_out_at ?? null}
          />
        </div>
      </Card>

      <Card title="Email">
        <SendEmailPanel
          participantId={p.id}
          participantEmail={p.email}
          templates={emailTemplates}
          optedOut={!!emailOptOut}
        />
      </Card>

      <Card title="WhatsApp (manual launch link)">
        <WhatsAppPanel
          participantId={p.id}
          participantPhone={p.phone_e164}
          templates={waTemplates}
          mergeContext={mergeContext}
          optedOut={!!waOptOut}
        />
      </Card>

      {comms.length > 0 && (
        <Card title="Communications">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {comms.map((c) => (
              <li key={c.id} className="px-4 py-2 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{c.subject ?? '(no subject)'}</span>
                  <span
                    className={`text-xs ${
                      c.status === 'sent'
                        ? 'text-green-700 dark:text-green-400'
                        : c.status === 'failed'
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-zinc-500'
                    }`}
                  >
                    {c.channel} · {c.status}
                  </span>
                </div>
                <p className="font-mono text-xs text-zinc-500">
                  {new Date(c.created_at).toLocaleString()}
                  {c.error && <span className="ml-2 text-red-700">— {c.error}</span>}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Identity">
        <Field label="Email" value={p.email} mono />
        <Field label="WhatsApp" value={p.phone_e164} mono />
        <Field label="Alt phone" value={p.alt_phone} mono />
        <Field label="City" value={p.current_city} />
        <Field label="Country" value={p.current_country} />
      </Card>

      <Card title="Reunion">
        <Field label="Batch" value={p.reunion?.batch?.toString() ?? null} />
        <Field
          label="Dorm"
          value={
            p.reunion?.dorm
              ? `${p.reunion.dorm}${p.reunion.dorm_number ? ` #${p.reunion.dorm_number}` : ''}`
              : null
          }
        />
        <Field label="Section (1st year)" value={p.reunion?.section} />
        <Field
          label="Spouse"
          value={
            p.reunion?.spouse_name
              ? `${p.reunion.spouse_name}${
                  p.reunion.spouse_dorm
                    ? ` (${p.reunion.spouse_dorm}${p.reunion.spouse_dorm_number ? ` #${p.reunion.spouse_dorm_number}` : ''})`
                    : ''
                }`
              : null
          }
        />
      </Card>

      <Card title="Engagement">
        <Field
          label="Last contacted"
          value={
            p.last_contacted_at
              ? new Date(p.last_contacted_at).toLocaleString()
              : null
          }
        />
        <Field
          label="Channel"
          value={
            p.last_contacted_channel &&
            (COMM_CHANNELS as readonly string[]).includes(p.last_contacted_channel)
              ? p.last_contacted_channel
              : null
          }
        />
        <Field label="Self-reported status" value={p.self_reported_status} />
        <Field
          label="Form submitted"
          value={
            p.form_submitted_at
              ? new Date(p.form_submitted_at).toLocaleDateString()
              : null
          }
        />
        <Field label="Notes" value={p.notes} multiline />
      </Card>

      <Card title="Provenance">
        <Field label="Source" value={p.source} />
        <Field
          label="Sheet row"
          value={
            p.sheet_row_number ? (
              sheetRowLink ? (
                <a
                  href={sheetRowLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline hover:text-blue-900 dark:text-blue-400"
                >
                  Row {p.sheet_row_number} ↗
                </a>
              ) : (
                `Row ${p.sheet_row_number}`
              )
            ) : null
          }
        />
        <Field label="Created" value={new Date(p.created_at).toLocaleString()} />
        <Field label="Updated" value={new Date(p.updated_at).toLocaleString()} />
      </Card>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
      <h2 className="border-b border-zinc-200 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
        {title}
      </h2>
      <dl className="divide-y divide-zinc-100 dark:divide-zinc-900">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: React.ReactNode | string | null | undefined;
  mono?: boolean;
  multiline?: boolean;
}) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="flex items-start gap-4 px-4 py-2 text-sm">
      <dt className="w-40 shrink-0 text-zinc-500">{label}</dt>
      <dd
        className={`flex-1 ${mono ? 'font-mono text-xs' : ''} ${multiline ? 'whitespace-pre-wrap' : ''} ${empty ? 'text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}
      >
        {empty ? '—' : value}
      </dd>
    </div>
  );
}
