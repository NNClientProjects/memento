import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentEventId } from '@/lib/event-context';
import type { Communication } from '@/modules/communications/types';

export const dynamic = 'force-dynamic';

type ParticipantLite = { id: string; full_name: string; phone_e164: string | null };

async function fetchInbound(
  eventId: string,
  limit: number
): Promise<Communication[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('communications')
    .select('*')
    .eq('event_id', eventId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Communication[];
}

async function fetchParticipants(
  ids: string[]
): Promise<Map<string, ParticipantLite>> {
  if (ids.length === 0) return new Map();
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('participants')
    .select('id, full_name, phone_e164')
    .in('id', ids);
  if (error) throw error;
  return new Map(
    ((data ?? []) as ParticipantLite[]).map((p) => [p.id, p])
  );
}

export default async function InboxPage() {
  const eventId = await getCurrentEventId();
  const comms = await fetchInbound(eventId, 200);
  const pmap = await fetchParticipants(
    Array.from(
      new Set(comms.map((c) => c.participant_id).filter((x): x is string => !!x))
    )
  );

  const matched = comms.filter((c) => c.participant_id);
  const unmatched = comms.filter((c) => !c.participant_id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Inbound WhatsApp messages forwarded by the router. {matched.length}{' '}
          matched to participants
          {unmatched.length > 0 && <> · {unmatched.length} unmatched</>}
        </p>
      </header>

      {comms.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No inbound messages yet. The router will POST forwarded webhooks to{' '}
          <code>/api/whatsapp/inbound</code> as participants reply.
        </p>
      ) : (
        <div className="space-y-3">
          {comms.map((c) => {
            const p = c.participant_id ? pmap.get(c.participant_id) : null;
            return (
              <article
                key={c.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <div>
                    {p ? (
                      <Link
                        href={`/participants/${p.id}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {p.full_name}
                      </Link>
                    ) : (
                      <span className="font-medium text-zinc-500">
                        Unmatched sender
                      </span>
                    )}
                    {p?.phone_e164 && (
                      <span className="ml-2 font-mono text-xs text-zinc-500">
                        {p.phone_e164}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-zinc-500">
                    {new Date(c.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                  {c.body || (
                    <span className="italic text-zinc-500">(empty body)</span>
                  )}
                </p>
                {c.external_id && (
                  <p className="mt-1 font-mono text-[10px] text-zinc-400">
                    id: {c.external_id}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
