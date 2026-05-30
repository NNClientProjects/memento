import Link from 'next/link';
import { recentCommunications } from '@/modules/communications/repository';
import { getCurrentEventId } from '@/lib/event-context';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type ParticipantLite = { id: string; full_name: string; email: string | null };

async function fetchParticipants(ids: string[]): Promise<Map<string, ParticipantLite>> {
  if (ids.length === 0) return new Map();
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('participants')
    .select('id, full_name, email')
    .in('id', ids);
  if (error) throw error;
  return new Map(
    ((data ?? []) as ParticipantLite[]).map((p) => [p.id, p])
  );
}

export default async function CommunicationsPage() {
  const eventId = await getCurrentEventId();
  const comms = await recentCommunications(eventId, 100);
  const participantIds = Array.from(
    new Set(comms.map((c) => c.participant_id).filter((x): x is string => !!x))
  );
  const pmap = await fetchParticipants(participantIds);

  const stats = {
    sent: comms.filter((c) => c.status === 'sent').length,
    failed: comms.filter((c) => c.status === 'failed').length,
    queued: comms.filter((c) => c.status === 'queued').length,
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Communications</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Recent outbound messages. Showing last 100 · {stats.sent} sent ·{' '}
          {stats.failed} failed
          {stats.queued > 0 && <> · {stats.queued} queued</>}
        </p>
      </header>

      {comms.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No communications yet. Send an email from a participant detail page
          or the bulk send page.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Recipient</th>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Channel</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {comms.map((c) => {
                const p = c.participant_id ? pmap.get(c.participant_id) : null;
                return (
                  <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {new Date(c.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {p ? (
                        <Link
                          href={`/participants/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.full_name}
                        </Link>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                      {p?.email && (
                        <div className="font-mono text-zinc-500">{p.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {c.subject ?? <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono">{c.channel}</td>
                    <td className="px-4 py-2 text-xs">
                      <span
                        className={
                          c.status === 'sent'
                            ? 'text-green-700 dark:text-green-400'
                            : c.status === 'failed'
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-zinc-600 dark:text-zinc-400'
                        }
                      >
                        {c.status}
                      </span>
                      {c.error && (
                        <div className="mt-0.5 text-red-700 dark:text-red-400">
                          {c.error}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
