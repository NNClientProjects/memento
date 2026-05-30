import Link from 'next/link';
import { listStages, countParticipantsInStage } from '@/modules/stages/repository';
import { getCurrentEventId } from '@/lib/event-context';
import { StageBadge } from '@/components/stage-badge';
import { StageForm } from '@/components/stage-form';

export const dynamic = 'force-dynamic';

export default async function StagesPage() {
  const eventId = await getCurrentEventId();
  const stages = await listStages(eventId);
  const counts = await Promise.all(
    stages.map((s) => countParticipantsInStage(s.id))
  );

  const hasInitial = stages.some((s) => s.is_initial);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Stages</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Lifecycle stages a participant moves through. Edit names, colors, and
          order. Automation rules run based on time spent in each stage.
        </p>
      </header>

      {!hasInitial && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-medium">No initial stage marked</p>
          <p className="mt-1 text-xs">
            Mark one stage as <span className="font-medium">initial</span> so
            new participants synced from the master sheet have a starting state.
          </p>
        </div>
      )}

      <section className="mb-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="border-b border-zinc-200 bg-zinc-50/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
          Add a new stage
        </h2>
        <div className="p-4">
          <StageForm mode="create" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Current stages ({stages.length})
        </h2>
        {stages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No stages yet. Add one above.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            {stages.map((s, idx) => (
              <li
                key={s.id}
                className="flex flex-wrap items-baseline gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-900"
              >
                <span className="w-8 font-mono text-xs text-zinc-400">
                  {s.ordinal}
                </span>
                <StageBadge name={s.name} color={s.color} terminal={s.is_terminal} />
                <span className="font-mono text-xs text-zinc-500">{s.slug}</span>
                <div className="flex flex-wrap gap-1.5">
                  {s.is_initial && (
                    <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900">
                      initial
                    </span>
                  )}
                  {s.is_terminal && (
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
                      terminal
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-500">
                  {counts[idx]} participant{counts[idx] === 1 ? '' : 's'}
                </span>
                <Link
                  href={`/stages/${s.id}`}
                  className="ml-auto text-xs text-indigo-700 hover:underline dark:text-indigo-400"
                >
                  Edit →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
