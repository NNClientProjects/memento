import { getSupabaseAdmin } from '@/lib/supabase';
import type { CommChannel } from '@/lib/lifecycle';

export type OptOut = {
  id: string;
  event_id: string;
  participant_id: string;
  channel: CommChannel;
  opted_out_at: string;
  reason: string | null;
};

export async function isOptedOut(
  participantId: string,
  channel: CommChannel
): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('opt_outs')
    .select('id')
    .eq('participant_id', participantId)
    .eq('channel', channel)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function listOptOutsForParticipant(
  participantId: string
): Promise<OptOut[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('opt_outs')
    .select('*')
    .eq('participant_id', participantId);
  if (error) throw error;
  return (data ?? []) as OptOut[];
}

export async function getOptedOutSet(
  eventId: string,
  channel: CommChannel
): Promise<Set<string>> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('opt_outs')
    .select('participant_id')
    .eq('event_id', eventId)
    .eq('channel', channel);
  if (error) throw error;
  return new Set(
    ((data ?? []) as Array<{ participant_id: string }>).map((r) => r.participant_id)
  );
}

export async function optOut(opts: {
  eventId: string;
  participantId: string;
  channel: CommChannel;
  reason?: string | null;
}): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from('opt_outs').upsert(
    {
      event_id: opts.eventId,
      participant_id: opts.participantId,
      channel: opts.channel,
      reason: opts.reason ?? null,
      opted_out_at: new Date().toISOString(),
    },
    { onConflict: 'participant_id,channel' }
  );
  if (error) throw error;

  await db.from('audit_log').insert({
    event_id: opts.eventId,
    entity_type: 'participant',
    entity_id: opts.participantId,
    action: 'opt_out',
    after: { channel: opts.channel, reason: opts.reason ?? null },
  });
}

export async function optIn(opts: {
  eventId: string;
  participantId: string;
  channel: CommChannel;
}): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from('opt_outs')
    .delete()
    .eq('participant_id', opts.participantId)
    .eq('channel', opts.channel);
  if (error) throw error;

  await db.from('audit_log').insert({
    event_id: opts.eventId,
    entity_type: 'participant',
    entity_id: opts.participantId,
    action: 'opt_in',
    after: { channel: opts.channel },
  });
}
