import Link from 'next/link';
import { listRules, countCandidatesForRule } from '@/modules/rules/repository';
import { listStages } from '@/modules/stages/repository';
import { listTemplates } from '@/modules/communications/repository';
import { getCurrentEventId } from '@/lib/event-context';
import { RuleForm } from '@/components/rule-form';
import { RunAutomationsButton } from '@/components/run-automations-button';

export const dynamic = 'force-dynamic';

export default async function AutomationsPage() {
  const eventId = await getCurrentEventId();
  const [rules, stages, emailTemplates, whatsappTemplates] = await Promise.all([
    listRules(eventId),
    listStages(eventId),
    listTemplates(eventId, 'email'),
    listTemplates(eventId, 'whatsapp'),
  ]);

  const stagesById = new Map(stages.map((s) => [s.id, s]));
  const templatesById = new Map(
    [...emailTemplates, ...whatsappTemplates].map((t) => [t.id, t])
  );

  const candidateCounts = await Promise.all(
    rules.map((r) => countCandidatesForRule(r))
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Automations</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Rules that fire when a participant has been in a stage for too long.
            Each rule sends a template or moves the participant to a new stage.
          </p>
        </div>
        <RunAutomationsButton />
      </header>

      <section className="mb-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="border-b border-zinc-200 bg-zinc-50/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
          Add a new automation
        </h2>
        <div className="p-4">
          <RuleForm
            mode="create"
            stages={stages}
            emailTemplates={emailTemplates}
            whatsappTemplates={whatsappTemplates}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Existing ({rules.length})
        </h2>
        {rules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No automations yet. Add one above.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/40">
            {rules.map((r, i) => {
              const triggerStage = stagesById.get(r.trigger_stage_id);
              const template = r.action_template_id
                ? templatesById.get(r.action_template_id)
                : null;
              const targetStage = r.action_target_stage_id
                ? stagesById.get(r.action_target_stage_id)
                : null;

              return (
                <li key={r.id} className="px-4 py-3.5 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          r.enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                        aria-hidden="true"
                      />
                      <Link
                        href={`/automations/${r.id}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {r.name}
                      </Link>
                      {!r.enabled && (
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-500 dark:bg-zinc-800">
                          disabled
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500">
                      {candidateCounts[i]} would fire
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    When in{' '}
                    <span className="font-medium">
                      {triggerStage?.name ?? '(stage removed)'}
                    </span>{' '}
                    for {r.trigger_stale_days} day
                    {r.trigger_stale_days === 1 ? '' : 's'} →{' '}
                    {r.action_type === 'send_template' ? (
                      <>
                        send{' '}
                        <span className="font-medium">
                          {template ? `${template.channel} / ${template.name}` : '(template missing)'}
                        </span>
                      </>
                    ) : (
                      <>
                        move to{' '}
                        <span className="font-medium">
                          {targetStage?.name ?? '(stage missing)'}
                        </span>
                      </>
                    )}
                    {' · '}
                    cooldown {r.cooldown_hours}h
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
