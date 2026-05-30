import { getSupabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/integrations/gmail/client';
import {
  getParticipantById,
  type ParticipantWithReunion,
} from '@/modules/participants/repository';
import { render, unknownFields, type MergeContext } from './merge-fields';
import { getTemplate } from './repository';
import { getOptedOutSet } from './opt-out';
import { optOutLink } from '@/lib/opt-out-token';
import type { Template } from './types';

export function participantMergeContext(
  p: ParticipantWithReunion,
  eventName: string
): MergeContext {
  return {
    full_name: p.full_name,
    first_name: p.full_name.split(/\s+/)[0] ?? '',
    email: p.email ?? '',
    phone: p.phone_e164 ?? '',
    dorm: p.reunion?.dorm ?? '',
    dorm_number: p.reunion?.dorm_number ?? '',
    section: p.reunion?.section ?? '',
    family_group_id: p.family_group_id ?? '',
    event_name: eventName,
  };
}

export type SendRecipientResult = {
  participantId: string;
  to: string | null;
  subject: string;
  body: string;
  status: 'previewed' | 'sent' | 'failed' | 'skipped';
  error?: string;
  externalId?: string;
};

export type SendResult = {
  ok: true;
  dryRun: boolean;
  template: { id: string; name: string };
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  optedOut: number;
  unknownFields: string[];
  recipients: SendRecipientResult[];
};

export type SendError = { ok: false; error: string };

export type SendOutcome = SendResult | SendError;

const RATE_LIMIT_MS = 200;
export const MAX_RECIPIENTS_PER_SEND = 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function appendUnsubscribeFooter(body: string, participantId: string): string {
  if (!process.env.OPT_OUT_SECRET) return body;
  const link = optOutLink(participantId, 'email');
  const looksHtml = /<\w+[^>]*>/.test(body);
  if (looksHtml) {
    return `${body}\n<hr style="margin-top:24px;border:none;border-top:1px solid #ddd"><p style="color:#666;font-size:12px">To stop receiving these messages, <a href="${link}">unsubscribe</a>.</p>`;
  }
  return `${body}\n\n---\nTo stop receiving these messages: ${link}`;
}

export async function sendTemplate(params: {
  templateId: string;
  recipientIds: string[];
  dryRun: boolean;
  eventId: string;
  eventName: string;
}): Promise<SendOutcome> {
  const { templateId, recipientIds, dryRun, eventId, eventName } = params;

  if (recipientIds.length === 0) {
    return { ok: false, error: 'no recipients' };
  }
  if (!dryRun && recipientIds.length > MAX_RECIPIENTS_PER_SEND) {
    return {
      ok: false,
      error: `${recipientIds.length} recipients exceeds Phase 1 cap of ${MAX_RECIPIENTS_PER_SEND}/send. Apply a tighter filter.`,
    };
  }

  const template: Template | null = await getTemplate(templateId);
  if (!template) return { ok: false, error: 'template not found' };
  if (template.event_id !== eventId)
    return { ok: false, error: 'template belongs to a different event' };
  if (template.channel !== 'email')
    return { ok: false, error: `cannot send: template channel is ${template.channel}` };

  if (!dryRun && template.status !== 'approved') {
    return {
      ok: false,
      error: `cannot send: template status is "${template.status}" (must be "approved"). Approve it from the template page first.`,
    };
  }

  const unknown = unknownFields(template.merge_fields);

  const result: SendResult = {
    ok: true,
    dryRun,
    template: { id: template.id, name: template.name },
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    optedOut: 0,
    unknownFields: unknown,
    recipients: [],
  };

  const seenEmails = new Set<string>();
  const db = getSupabaseAdmin();
  const optedOut = await getOptedOutSet(eventId, template.channel);

  for (const pid of recipientIds) {
    const participant = await getParticipantById(eventId, pid);
    if (!participant) {
      result.recipients.push({
        participantId: pid,
        to: null,
        subject: '',
        body: '',
        status: 'skipped',
        error: 'participant not found',
      });
      result.skipped += 1;
      continue;
    }

    if (!participant.email) {
      result.recipients.push({
        participantId: pid,
        to: null,
        subject: '',
        body: '',
        status: 'skipped',
        error: 'no email on file',
      });
      result.skipped += 1;
      continue;
    }

    if (seenEmails.has(participant.email)) {
      result.recipients.push({
        participantId: pid,
        to: participant.email,
        subject: '',
        body: '',
        status: 'skipped',
        error: 'duplicate email in this batch',
      });
      result.skipped += 1;
      continue;
    }
    seenEmails.add(participant.email);

    if (optedOut.has(pid)) {
      result.recipients.push({
        participantId: pid,
        to: participant.email,
        subject: '',
        body: '',
        status: 'skipped',
        error: `opted out of ${template.channel}`,
      });
      result.optedOut += 1;
      continue;
    }

    const ctx = participantMergeContext(participant, eventName);
    const subject = render(template.subject ?? '', ctx);
    const renderedBody = render(template.body, ctx);
    const body =
      template.channel === 'email'
        ? appendUnsubscribeFooter(renderedBody, pid)
        : renderedBody;
    result.attempted += 1;

    if (dryRun) {
      result.recipients.push({
        participantId: pid,
        to: participant.email,
        subject,
        body,
        status: 'previewed',
      });
      continue;
    }

    const { data: commRow, error: cErr } = await db
      .from('communications')
      .insert({
        event_id: eventId,
        participant_id: pid,
        channel: 'email',
        direction: 'outbound',
        template_id: template.id,
        subject,
        body,
        status: 'queued',
      })
      .select('id')
      .single();
    if (cErr) throw cErr;
    const commId = (commRow as { id: string }).id;

    const sendRes = await sendEmail({ to: participant.email, subject, body });

    if (sendRes.ok) {
      await db
        .from('communications')
        .update({
          status: 'sent',
          external_id: sendRes.messageId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', commId);
      result.recipients.push({
        participantId: pid,
        to: participant.email,
        subject,
        body,
        status: 'sent',
        externalId: sendRes.messageId,
      });
      result.sent += 1;
    } else {
      await db
        .from('communications')
        .update({ status: 'failed', error: sendRes.error })
        .eq('id', commId);
      result.recipients.push({
        participantId: pid,
        to: participant.email,
        subject,
        body,
        status: 'failed',
        error: sendRes.error,
      });
      result.failed += 1;
    }

    if (recipientIds.length > 1) await sleep(RATE_LIMIT_MS);
  }

  return result;
}
