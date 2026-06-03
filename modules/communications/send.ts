import { getSupabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/integrations/gmail/client';
import {
  sendWhatsAppTemplate,
  isMetaSendSkip,
} from '@/integrations/whatsapp/meta-cloud';
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
  template: { id: string; name: string; channel: 'email' | 'whatsapp' };
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

  const isEmail = template.channel === 'email';
  const isWhatsApp = template.channel === 'whatsapp';
  if (!isEmail && !isWhatsApp) {
    return {
      ok: false,
      error: `cannot send: channel "${template.channel}" not supported (use email or whatsapp)`,
    };
  }

  if (!dryRun && template.status !== 'approved') {
    return {
      ok: false,
      error: `cannot send: template status is "${template.status}" (must be "approved"). Approve it from the template page first.`,
    };
  }

  if (!dryRun && isWhatsApp && !template.provider_template_id) {
    return {
      ok: false,
      error:
        'WhatsApp template is missing the Meta template name (set "Meta template name" on the template page).',
    };
  }

  const unknown = unknownFields(template.merge_fields);
  const channel: 'email' | 'whatsapp' = isEmail ? 'email' : 'whatsapp';

  const result: SendResult = {
    ok: true,
    dryRun,
    template: { id: template.id, name: template.name, channel },
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    optedOut: 0,
    unknownFields: unknown,
    recipients: [],
  };

  const seenContacts = new Set<string>();
  const db = getSupabaseAdmin();
  const optedOut = await getOptedOutSet(eventId, channel);
  const now = () => new Date().toISOString();

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

    const contact = isEmail ? participant.email : participant.phone_e164;
    if (!contact) {
      result.recipients.push({
        participantId: pid,
        to: null,
        subject: '',
        body: '',
        status: 'skipped',
        error: isEmail ? 'no email on file' : 'no phone on file',
      });
      result.skipped += 1;
      continue;
    }

    if (seenContacts.has(contact)) {
      result.recipients.push({
        participantId: pid,
        to: contact,
        subject: '',
        body: '',
        status: 'skipped',
        error: `duplicate ${channel} contact in this batch`,
      });
      result.skipped += 1;
      continue;
    }
    seenContacts.add(contact);

    if (optedOut.has(pid)) {
      result.recipients.push({
        participantId: pid,
        to: contact,
        subject: '',
        body: '',
        status: 'skipped',
        error: `opted out of ${channel}`,
      });
      result.optedOut += 1;
      continue;
    }

    const ctx = participantMergeContext(participant, eventName);
    const subject = isEmail ? render(template.subject ?? '', ctx) : '';
    const renderedBody = render(template.body, ctx);
    const body = isEmail
      ? appendUnsubscribeFooter(renderedBody, pid)
      : renderedBody;
    result.attempted += 1;

    if (dryRun) {
      result.recipients.push({
        participantId: pid,
        to: contact,
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
        channel,
        direction: 'outbound',
        template_id: template.id,
        subject: isEmail ? subject : null,
        body,
        status: 'queued',
      })
      .select('id')
      .single();
    if (cErr) throw cErr;
    const commId = (commRow as { id: string }).id;

    let externalId: string | undefined;
    let errorMsg: string | undefined;

    if (isEmail) {
      const r = await sendEmail({ to: contact, subject, body });
      if (r.ok) externalId = r.messageId;
      else errorMsg = r.error;
    } else {
      // WhatsApp via Meta Cloud API. Positional params come from merge_fields order.
      const paramValues = template.merge_fields.map((f) => ctx[f] ?? '');
      const r = await sendWhatsAppTemplate({
        templateName: template.provider_template_id!,
        languageCode: template.provider_language_code,
        to: contact,
        bodyParameters: paramValues,
      });
      if (isMetaSendSkip(r)) {
        errorMsg = 'Meta WhatsApp Cloud API not configured (set META_WHATSAPP_*)';
      } else if (r.ok) {
        externalId = r.messageId;
      } else {
        errorMsg = r.error;
      }
    }

    if (externalId) {
      await db
        .from('communications')
        .update({ status: 'sent', external_id: externalId, sent_at: now() })
        .eq('id', commId);
      result.recipients.push({
        participantId: pid,
        to: contact,
        subject,
        body,
        status: 'sent',
        externalId,
      });
      result.sent += 1;
    } else {
      await db
        .from('communications')
        .update({ status: 'failed', error: errorMsg ?? 'unknown' })
        .eq('id', commId);
      result.recipients.push({
        participantId: pid,
        to: contact,
        subject,
        body,
        status: 'failed',
        error: errorMsg,
      });
      result.failed += 1;
    }

    if (recipientIds.length > 1) await sleep(RATE_LIMIT_MS);
  }

  return result;
}
