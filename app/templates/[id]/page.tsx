import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTemplate } from '@/modules/communications/repository';
import { TemplateForm } from '@/components/template-form';
import { DeleteTemplateButton } from '@/components/delete-template-button';

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/templates" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Templates
        </Link>
      </nav>

      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {template.name}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Created {new Date(template.created_at).toLocaleString()} · Last
            saved {new Date(template.updated_at).toLocaleString()}
          </p>
        </div>
        <DeleteTemplateButton templateId={template.id} />
      </header>

      <TemplateForm mode="edit" template={template} />
    </main>
  );
}
