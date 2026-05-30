import Link from 'next/link';
import { listTemplates } from '@/modules/communications/repository';
import { getCurrentEventId } from '@/lib/event-context';
import { TemplateForm } from '@/components/template-form';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const eventId = await getCurrentEventId();
  const templates = await listTemplates(eventId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Email and (later) WhatsApp templates with merge fields. Mark as
          &ldquo;Approved&rdquo; once you&apos;re happy with the copy — only
          approved templates can be sent.
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <h2 className="border-b border-zinc-200 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
          New template
        </h2>
        <div className="p-4">
          <TemplateForm mode="create" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Existing ({templates.length})
        </h2>
        {templates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No templates yet. Create one above.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {templates.map((t) => (
              <li key={t.id} className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <Link
                      href={`/templates/${t.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {t.name}
                    </Link>
                    <span className="ml-3 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono dark:bg-zinc-800">
                      {t.channel}
                    </span>
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                        t.status === 'approved'
                          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                          : t.status === 'rejected'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-zinc-500">
                    {new Date(t.updated_at).toLocaleDateString()}
                  </span>
                </div>
                {t.subject && (
                  <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {t.subject}
                  </p>
                )}
                {t.merge_fields.length > 0 && (
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    fields: {t.merge_fields.join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
