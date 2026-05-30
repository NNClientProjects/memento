'use server';

import { verifyOptOutToken } from '@/lib/opt-out-token';
import { getSupabaseAdmin } from '@/lib/supabase';
import { optOut, optIn } from '@/modules/communications/opt-out';

export type UnsubscribeResult =
  | { ok: true; action: 'opted_out' | 'opted_in'; channel: 'email' | 'whatsapp' }
  | { ok: false; error: string };

async function lookupEvent(participantId: string): Promise<string | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('participants')
    .select('event_id')
    .eq('id', participantId)
    .maybeSingle();
  if (error) return null;
  return ((data as { event_id: string } | null)?.event_id) ?? null;
}

export async function confirmUnsubscribeAction(
  _prev: UnsubscribeResult | null,
  formData: FormData
): Promise<UnsubscribeResult> {
  const token = String(formData.get('token') ?? '');
  const parsed = verifyOptOutToken(token);
  if (!parsed) return { ok: false, error: 'invalid or expired link' };

  const eventId = await lookupEvent(parsed.participantId);
  if (!eventId) return { ok: false, error: 'participant not found' };

  try {
    await optOut({
      eventId,
      participantId: parsed.participantId,
      channel: parsed.channel,
      reason: 'user_unsubscribe_link',
    });
    return { ok: true, action: 'opted_out', channel: parsed.channel };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function resubscribeAction(
  _prev: UnsubscribeResult | null,
  formData: FormData
): Promise<UnsubscribeResult> {
  const token = String(formData.get('token') ?? '');
  const parsed = verifyOptOutToken(token);
  if (!parsed) return { ok: false, error: 'invalid or expired link' };

  const eventId = await lookupEvent(parsed.participantId);
  if (!eventId) return { ok: false, error: 'participant not found' };

  try {
    await optIn({
      eventId,
      participantId: parsed.participantId,
      channel: parsed.channel,
    });
    return { ok: true, action: 'opted_in', channel: parsed.channel };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
