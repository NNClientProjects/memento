import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentEventId } from '@/lib/event-context';

export const runtime = 'nodejs';

// Logs a manual WhatsApp launch-link attempt. Fire-and-forget from the client
// after window.open() — body in JSON: { participantId, templateId, body }.
export async function POST(request: Request) {
  let payload: {
    participantId?: string;
    templateId?: string;
    body?: string;
    subject?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const participantId = String(payload.participantId ?? '');
  const templateId = String(payload.templateId ?? '');
  const body = String(payload.body ?? '');
  if (!participantId || !templateId || !body) {
    return NextResponse.json(
      { error: 'participantId, templateId, body required' },
      { status: 400 }
    );
  }

  try {
    const eventId = await getCurrentEventId();
    const db = getSupabaseAdmin();
    const { error } = await db.from('communications').insert({
      event_id: eventId,
      participant_id: participantId,
      channel: 'whatsapp',
      direction: 'outbound',
      template_id: templateId,
      subject: payload.subject ?? null,
      body,
      status: 'queued',
      sent_at: new Date().toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
