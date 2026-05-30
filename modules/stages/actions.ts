'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentEventId } from '@/lib/event-context';
import {
  createStage,
  updateStage,
  deleteStage,
  suggestSlug,
  countParticipantsInStage,
} from './repository';
import { isStageColor } from './types';

export type StageActionResult =
  | { ok: true; message: string; stageId?: string }
  | { ok: false; error: string };

function validateColor(color: string): string {
  return isStageColor(color) ? color : 'zinc';
}

export async function createStageAction(
  _prev: StageActionResult | null,
  formData: FormData
): Promise<StageActionResult> {
  const name = String(formData.get('name') ?? '').trim();
  const slugRaw = String(formData.get('slug') ?? '').trim();
  const slug = slugRaw || suggestSlug(name);
  const description = String(formData.get('description') ?? '').trim() || null;
  const ordinal = Number(formData.get('ordinal') ?? 0);
  const color = validateColor(String(formData.get('color') ?? 'zinc'));
  const isInitial = formData.get('is_initial') === '1';
  const isTerminal = formData.get('is_terminal') === '1';

  if (!name) return { ok: false, error: 'name is required' };
  if (!slug) return { ok: false, error: 'slug could not be generated; provide one' };

  try {
    const eventId = await getCurrentEventId();
    const stage = await createStage({
      eventId,
      slug,
      name,
      description,
      ordinal: Number.isFinite(ordinal) ? ordinal : 0,
      color,
      is_initial: isInitial,
      is_terminal: isTerminal,
    });
    revalidatePath('/stages');
    revalidatePath('/participants');
    return {
      ok: true,
      message: `Stage "${stage.name}" created.`,
      stageId: stage.id,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateStageAction(
  _prev: StageActionResult | null,
  formData: FormData
): Promise<StageActionResult> {
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const ordinal = Number(formData.get('ordinal') ?? 0);
  const color = validateColor(String(formData.get('color') ?? 'zinc'));
  const isInitial = formData.get('is_initial') === '1';
  const isTerminal = formData.get('is_terminal') === '1';

  if (!id) return { ok: false, error: 'missing stage id' };
  if (!name) return { ok: false, error: 'name is required' };
  if (!slug) return { ok: false, error: 'slug is required' };

  try {
    await updateStage(id, {
      slug,
      name,
      description,
      ordinal: Number.isFinite(ordinal) ? ordinal : 0,
      color,
      is_initial: isInitial,
      is_terminal: isTerminal,
    });
    revalidatePath('/stages');
    revalidatePath(`/stages/${id}`);
    revalidatePath('/participants');
    return { ok: true, message: 'Stage saved.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteStageAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const count = await countParticipantsInStage(id);
  if (count > 0) {
    revalidatePath(`/stages/${id}`);
    return;
  }
  await deleteStage(id);
  revalidatePath('/stages');
  redirect('/stages');
}
