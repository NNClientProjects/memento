'use server';

import { revalidatePath } from 'next/cache';
import type { CommChannel } from '@/lib/lifecycle';
import { COMM_CHANNELS } from '@/lib/lifecycle';
import { getCurrentEventId } from '@/lib/event-context';
import { optOut, optIn } from './opt-out';

export type OptOutToggleResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function toggleOptOutAction(
  _prev: OptOutToggleResult | null,
  formData: FormData
): Promise<OptOutToggleResult> {
  const participantId = String(formData.get('participantId') ?? '');
  const channel = String(formData.get('channel') ?? '') as CommChannel;
  const direction = String(formData.get('direction') ?? '');

  if (!participantId) return { ok: false, error: 'missing participantId' };
  if (!(COMM_CHANNELS as readonly string[]).includes(channel))
    return { ok: false, error: `invalid channel: ${channel}` };
  if (direction !== 'opt_out' && direction !== 'opt_in')
    return { ok: false, error: `invalid direction: ${direction}` };

  try {
    const eventId = await getCurrentEventId();
    if (direction === 'opt_out') {
      await optOut({ eventId, participantId, channel, reason: 'organiser_manual' });
    } else {
      await optIn({ eventId, participantId, channel });
    }
    revalidatePath(`/participants/${participantId}`);
    revalidatePath('/participants');
    return {
      ok: true,
      message:
        direction === 'opt_out'
          ? `Marked as opted-out from ${channel}.`
          : `Resubscribed to ${channel}.`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
