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

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const parsed = verifyOptOutToken(token);

  if (!parsed) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-semibold">Invalid link</h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          This unsubscribe link is invalid or has been tampered with. If you
          received it in an email and believe this is a mistake, please reply
          to that email directly.
        </p>
      </main>
    );
  }

  const [name, alreadyOptedOut] = await Promise.all([
    lookupParticipantName(parsed.participantId),
    isOptedOut(parsed.participantId, parsed.channel),
  ]);

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Unsubscribe from {parsed.channel}
      </h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        {name ? `Hi ${name},` : 'Hi,'} you can stop receiving{' '}
        <span className="font-medium">{parsed.channel}</span> messages from
        Reunion 2026 organisers by confirming below.
      </p>

      <div className="mt-6">
        <UnsubscribeForm
          token={token}
          channel={parsed.channel}
          initiallyOptedOut={alreadyOptedOut}
        />
      </div>

      <p className="mt-8 text-xs text-zinc-500">
        Note: this only affects {parsed.channel}. Other channels are
        independent.
      </p>
    </main>
  );
}
