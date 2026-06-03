import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getRule,
  recentFiringsForRule,
  countCandidatesForRule,
} from '@/modules/rules/repository';
import { listStages } from '@/modules/stages/repository';
import { listTemplates } from '@/modules/communications/repository';
import { getCurrentEventId } from '@/lib/event-context';
import { RuleForm } from '@/components/rule-form';
import { DeleteRuleButton } from '@/components/delete-rule-button';

export const dynamic = 'force-dynamic';

export default async function EditRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rule = await getRule(id);
  if (!rule) notFound();

  const eventId = await getCurrentEventId();
  const [stages, emailTemplates, whatsappTemplates, firings, candidateCount] =
    await Promise.all([
      listStages(eventId),
      listTemplates(eventId, 'email'),
      listTemplates(eventId, 'whatsapp'),
      recentFiringsForRule(rule.id, 30),
      countCandidatesForRule(rule),
    ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link
          href="/automations"
          className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <span aria-hidden="true">←</span> Automations
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{rule.name}</h1>
        <p className="mt-1 text-xs text-zinc-500">
          {candidateCount} participant
          {candidateCount === 1 ? '' : 's'} would fire if run now (before
          cooldown / opt-out checks)
        </p>
      </header>

      <section className="mb-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="p-4">
          <RuleForm
            mode="edit"
            rule={rule}
            stages={stages}
            emailTemplates={emailTemplates}
            whatsappTemplates={whatsappTemplates}
          />
        </div>
      </section>

      <section className="mb-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="border-b border-zinc-200 bg-zinc-50/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
          Recent firings ({firings.length})
        </h2>
        {firings.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">
            No firings yet. The engine has not produced results for this rule.
          </p>
        ) : (
          <ol className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {firings.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-baseline gap-2 px-4 py-2 text-sm"
              >
                <span className="font-mono text-xs text-zinc-500">
                  {new Date(f.fired_at).toLocaleString()}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ring-1 ring-inset ${
                    f.outcome === 'success'
                      ? 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/40 dark:text-green-300 dark:ring-green-900'
                      : f.outcome === 'failed'
                        ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900'
                        : 'bg-zinc-100 text-zinc-600 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700'
                  }`}
                >
                  {f.outcome}
                </span>
                <Link
                  href={`/participants/${f.participant_id}`}
                  className="text-xs text-indigo-700 hover:underline dark:text-indigo-400"
                >
                  participant
                </Link>
                {f.skip_reason && (
                  <span className="text-xs text-zinc-500">{f.skip_reason}</span>
                )}
                {f.error && (
                  <span className="text-xs text-red-700 dark:text-red-400">
                    {f.error}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50/30 p-4 dark:border-red-900/40 dark:bg-red-950/20">
        <h2 className="text-sm font-semibold text-red-900 dark:text-red-300">
          Danger zone
        </h2>
        <p className="mt-1 text-xs text-red-800 dark:text-red-400">
          Deleting also removes the history of firings for this rule.
        </p>
        <div className="mt-3">
          <DeleteRuleButton ruleId={rule.id} />
        </div>
      </section>
    </main>
  );
}
