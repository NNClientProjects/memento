'use server';

import { revalidatePath } from 'next/cache';
import { COMM_CHANNELS, type CommChannel } from '@/lib/lifecycle';
import { getCurrentEventId, currentEventSlug } from '@/lib/event-context';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from './repository';
import { sendTemplate, type SendOutcome } from './send';
import type { TemplateStatus } from './types';

export type TemplateActionResult =
  | { ok: true; message: string; templateId?: string }
  | { ok: false; error: string };

const VALID_STATUSES: TemplateStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
];

export async function createTemplateAction(
  _prev: TemplateActionResult | null,
  formData: FormData
): Promise<TemplateActionResult> {
  const name = String(formData.get('name') ?? '').trim();
  const channel = String(formData.get('channel') ?? 'email') as CommChannel;
  const subject = String(formData.get('subject') ?? '').trim() || null;
  const body = String(formData.get('body') ?? '').trim();
  const status = String(formData.get('status') ?? 'draft') as TemplateStatus;

  if (!name) return { ok: false, error: 'name is required' };
  if (!body) return { ok: false, error: 'body is required' };
  if (!(COMM_CHANNELS as readonly string[]).includes(channel))
    return { ok: false, error: `invalid channel: ${channel}` };
  if (!VALID_STATUSES.includes(status))
    return { ok: false, error: `invalid status: ${status}` };

  try {
    const eventId = await getCurrentEventId();
    const t = await createTemplate({
      eventId,
      channel,
      name,
      subject,
      body,
      status,
    });
    revalidatePath('/templates');
    return { ok: true, message: `Template "${t.name}" created.`, templateId: t.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateTemplateAction(
  _prev: TemplateActionResult | null,
  formData: FormData
): Promise<TemplateActionResult> {
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim() || null;
  const body = String(formData.get('body') ?? '').trim();
  const status = String(formData.get('status') ?? 'draft') as TemplateStatus;

  if (!id) return { ok: false, error: 'missing template id' };
  if (!name) return { ok: false, error: 'name is required' };
  if (!body) return { ok: false, error: 'body is required' };
  if (!VALID_STATUSES.includes(status))
    return { ok: false, error: `invalid status: ${status}` };

  try {
    await updateTemplate(id, { name, subject, body, status });
    revalidatePath('/templates');
    revalidatePath(`/templates/${id}`);
    return { ok: true, message: 'Template saved.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteTemplateAction(
  _prev: TemplateActionResult | null,
  formData: FormData
): Promise<TemplateActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'missing template id' };
  try {
    await deleteTemplate(id);
    revalidatePath('/templates');
    return { ok: true, message: 'Template deleted.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type SendEmailActionResult = SendOutcome;

async function getEventName(eventId: string): Promise<string> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('events')
    .select('name')
    .eq('id', eventId)
    .maybeSingle();
  return ((data as { name: string } | null)?.name) ?? currentEventSlug();
}

export async function sendEmailAction(
  _prev: SendEmailActionResult | null,
  formData: FormData
): Promise<SendEmailActionResult> {
  const templateId = String(formData.get('templateId') ?? '');
  const recipientIdsRaw = String(formData.get('recipientIds') ?? '');
  const recipientIds = recipientIdsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const dryRun = formData.get('dryRun') === '1';

  if (!templateId) return { ok: false, error: 'pick a template' };
  if (recipientIds.length === 0)
    return { ok: false, error: 'no recipients provided' };

  try {
    const eventId = await getCurrentEventId();
    const eventName = await getEventName(eventId);
    const outcome = await sendTemplate({
      templateId,
      recipientIds,
      dryRun,
      eventId,
      eventName,
    });
    if (!dryRun && outcome.ok) {
      for (const pid of recipientIds) {
        revalidatePath(`/participants/${pid}`);
      }
      revalidatePath('/communications');
    }
    return outcome;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
