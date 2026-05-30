import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStage, countParticipantsInStage } from '@/modules/stages/repository';
import { deleteStageAction } from '@/modules/stages/actions';
import { StageForm } from '@/components/stage-form';

export const dynamic = 'force-dynamic';

export default async function EditStagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stage = await getStage(id);
  if (!stage) notFound();
  const count = await countParticipantsInStage(id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link
          href="/stages"
          className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <span aria-hidden="true">←</span> Stages
        </Link>
      </nav>

      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{stage.name}</h1>
          <p className="mt-1 text-xs text-zinc-500">
            {count} participant{count === 1 ? '' : 's'} currently in this stage
          </p>
        </div>
      </header>

      <section className="mb-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="p-4">
          <StageForm mode="edit" stage={stage} />
        </div>
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50/30 p-4 dark:border-red-900/40 dark:bg-red-950/20">
        <h2 className="text-sm font-semibold text-red-900 dark:text-red-300">
          Danger zone
        </h2>
        <p className="mt-1 text-xs text-red-800 dark:text-red-400">
          {count > 0
            ? `Cannot delete — ${count} participant${count === 1 ? ' is' : 's are'} still in this stage. Move them to another stage first.`
            : 'No participants in this stage. Safe to delete.'}
        </p>
        <form action={deleteStageAction} className="mt-3">
          <input type="hidden" name="id" value={stage.id} />
          <button
            type="submit"
            disabled={count > 0}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete stage
          </button>
        </form>
      </section>
    </main>
  );
}
