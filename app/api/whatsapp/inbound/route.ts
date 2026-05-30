import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentEventId } from '@/lib/event-context';
import { optOut } from '@/modules/communications/opt-out';
import {
  extractMessageFromMetaPayload,
  isStopMessage,
  type ForwardedInboundPayload,
} from '@/lib/whatsapp-inbound';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Receives webhook forwards from the router backend (the only system Meta sends
// inbound webhooks to). Auth via bearer = INBOUND_FORWARD_SECRET. Payload shape
// per docs/whatsapp-router-spec.md.

export async function POST(request: Request) {
  const expected = process.env.INBOUND_FORWARD_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'inbound forwarding not configured on this app' },
      { status: 503 }
    );
  }
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let payload: ForwardedInboundPayload;
  try {
    payload = (await request.json()) as ForwardedInboundPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const extracted = extractMessageFromMetaPayload(payload.meta_payload);
  if (!extracted) {
    return NextResponse.json({
      ok: true,
      handled: false,
      reason: 'no user message in payload (likely a status/delivery callback)',
    });
  }

  const senderPhone = extracted.senderPhoneE164 ?? payload.sender_phone ?? null;
  if (!senderPhone) {
    return NextResponse.json({
      ok: true,
      handled: false,
      reason: 'could not determine sender phone',
    });
  }

  const db = getSupabaseAdmin();

  // Idempotency: if we've already logged this Meta message id, skip.
  if (extracted.messageId) {
    const { data: existing } = await db
      .from('communications')
      .select('id')
      .eq('external_id', extracted.messageId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({
        ok: true,
        handled: true,
        deduplicated: true,
        commId: (existing as { id: string }).id,
      });
    }
  }

  const eventId = await getCurrentEventId();

  const { data: participantRow } = await db
    .from('participants')
    .select('id, full_name')
    .eq('event_id', eventId)
    .eq('phone_e164', senderPhone)
    .maybeSingle();
  const participant = participantRow as { id: string; full_name: string } | null;

  if (!participant) {
    // Not a reunion participant. Log as unattached inbound for visibility.
    const { data: commRow, error: cErr } = await db
      .from('communications')
      .insert({
        event_id: eventId,
        participant_id: null,
        channel: 'whatsapp',
        direction: 'inbound',
        subject: null,
        body: extracted.text ?? `[${extracted.messageType}]`,
        status: 'delivered',
        external_id: extracted.messageId,
      })
      .select('id')
      .single();
    if (cErr) throw cErr;
    return NextResponse.json({
      ok: true,
      handled: true,
      participantMatched: false,
      commId: (commRow as { id: string }).id,
    });
  }

  const { data: commRow, error: cErr } = await db
    .from('communications')
    .insert({
      event_id: eventId,
      participant_id: participant.id,
      channel: 'whatsapp',
      direction: 'inbound',
      subject: null,
      body: extracted.text ?? `[${extracted.messageType}]`,
      status: 'delivered',
      external_id: extracted.messageId,
    })
    .select('id')
    .single();
  if (cErr) throw cErr;
  const commId = (commRow as { id: string }).id;

  let optedOut = false;
  if (extracted.messageType === 'text' && isStopMessage(extracted.text)) {
    await optOut({
      eventId,
      participantId: participant.id,
      channel: 'whatsapp',
      reason: 'inbound_stop_keyword',
    });
    optedOut = true;
  }

  return NextResponse.json({
    ok: true,
    handled: true,
    participantMatched: true,
    participantId: participant.id,
    commId,
    optedOut,
  });
}
