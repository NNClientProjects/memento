import { getSupabaseAdmin } from '@/lib/supabase';
import type { CommChannel } from '@/lib/lifecycle';
import { extractMergeFields } from './merge-fields';
import type { Template, TemplateStatus, Communication } from './types';

export async function listTemplates(
  eventId: string,
  channel?: CommChannel
): Promise<Template[]> {
  const db = getSupabaseAdmin();
  let q = db
    .from('templates')
    .select('*')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  if (channel) q = q.eq('channel', channel);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Template[];
}

export async function getTemplate(id: string): Promise<Template | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Template | null) ?? null;
}

export type TemplateInput = {
  eventId: string;
  channel: CommChannel;
  name: string;
  subject?: string | null;
  body: string;
  status?: TemplateStatus;
};

export async function createTemplate(input: TemplateInput): Promise<Template> {
  const db = getSupabaseAdmin();
  const merge_fields = extractMergeFields(
    `${input.subject ?? ''} ${input.body}`
  );
  const { data, error } = await db
    .from('templates')
    .insert({
      event_id: input.eventId,
      channel: input.channel,
      name: input.name,
      subject: input.subject ?? null,
      body: input.body,
      merge_fields,
      status: input.status ?? 'draft',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Template;
}

export type TemplateUpdateInput = {
  name?: string;
  subject?: string | null;
  body?: string;
  status?: TemplateStatus;
};

export async function updateTemplate(
  id: string,
  patch: TemplateUpdateInput
): Promise<Template> {
  const db = getSupabaseAdmin();

  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.subject !== undefined) updates.subject = patch.subject;
  if (patch.body !== undefined) updates.body = patch.body;
  if (patch.status !== undefined) updates.status = patch.status;

  if (patch.body !== undefined || patch.subject !== undefined) {
    const current = await getTemplate(id);
    if (!current) throw new Error('template not found');
    const subject = patch.subject !== undefined ? patch.subject : current.subject;
    const body = patch.body !== undefined ? patch.body : current.body;
    updates.merge_fields = extractMergeFields(`${subject ?? ''} ${body}`);
  }

  const { data, error } = await db
    .from('templates')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Template;
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from('templates').delete().eq('id', id);
  if (error) throw error;
}

export async function recentCommunications(
  eventId: string,
  limit = 50
): Promise<Communication[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('communications')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Communication[];
}

export async function participantCommunications(
  participantId: string,
  limit = 20
): Promise<Communication[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('communications')
    .select('*')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Communication[];
}
