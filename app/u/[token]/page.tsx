import { verifyOptOutToken } from '@/lib/opt-out-token';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isOptedOut } from '@/modules/communications/opt-out';
import { UnsubscribeForm } from '@/components/unsubscribe-form';

export const dynamic = 'force-dynamic';

async function lookupParticipantName(participantId: string): Promise<string | null> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('participants')
    .select('full_name')
    .eq('id', participantId)
    .maybeSingle();
  return ((data as { full_name: string } | null)?.full_name) ?? null;
}

function ChannelLabel({ channel }: { channel: 'email' | 'whatsapp' }) {
  return (
    <span className="font-medium capitalize text-zinc-900 dark:text-zinc-100">
      {channel}
    </span>
  );
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const parsed = verifyOptOutToken(token);

  if (!parsed) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold tracking-tight">
          This link is invalid
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          The unsubscribe link is malformed or has been tampered with. If you
          received it in an email and believe this is a mistake, please reply
          to that email directly and we&apos;ll sort it out.
        </p>
      </Shell>
    );
  }

  const [name, alreadyOptedOut] = await Promise.all([
    lookupParticipantName(parsed.participantId),
    isOptedOut(parsed.participantId, parsed.channel),
  ]);

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">
        Unsubscribe from <ChannelLabel channel={parsed.channel} />
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {name ? <>Hi {name},</> : <>Hi,</>} you can stop receiving{' '}
        <ChannelLabel channel={parsed.channel} /> messages from the Reunion 2026
        organising committee with one click. We&apos;ll respect it immediately.
      </p>

      <div className="mt-6">
        <UnsubscribeForm
          token={token}
          channel={parsed.channel}
          initiallyOptedOut={alreadyOptedOut}
        />
      </div>

      <div className="mt-8 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
        <p>
          This only affects {parsed.channel}. Other channels (like the other
          one) are independent — you can opt out of each separately.
        </p>
        <p className="mt-2">
          Wrong person? Just close this window. Nothing happens until you click
          the button above.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-base font-bold text-white shadow-md shadow-indigo-600/20"
            aria-hidden="true"
          >
            M
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">Memento</p>
            <p className="text-xs text-zinc-500">Reunion 2026 · organisers</p>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {children}
        </div>
      </div>
    </main>
  );
}
