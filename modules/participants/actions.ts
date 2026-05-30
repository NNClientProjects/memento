'use server';

import { revalidatePath } from 'next/cache';
import { getStage } from '@/modules/stages/repository';
import {
  changeLifecycleStage,
  groupAsFamily,
  unlinkFromFamily,
  type WritebackOutcome,
} from './services';

export type ActionResult =
  | { ok: true; message?: string; severity?: 'success' | 'warning' }
  | { ok: false; error: string };

type WritebackDescription = {
  message: string;
  severity: 'success' | 'warning';
};

function describeWriteback(
  outcome: WritebackOutcome,
  baseMsg: string
): WritebackDescription {
  if (outcome.ok) {
    return { message: `${baseMsg} Sheet updated.`, severity: 'success' };
  }
  if (outcome.reason === 'grace') {
    return {
      message: `${baseMsg} Sheet write paused — organiser edited this row recently. Will reconcile after grace expires (${new Date(outcome.pendingUntil!).toLocaleTimeString()}).`,
      severity: 'warning',
    };
  }
  if (outcome.reason === 'no_sheet_row') {
    return {
      message: `${baseMsg} (No sheet row to update — this participant wasn't imported from the master Sheet.)`,
      severity: 'warning',
    };
  }
  if (outcome.reason === 'no_sheet_id') {
    return {
      message: `${baseMsg} (MASTER_SHEET_ID not configured — sheet not updated.)`,
      severity: 'warning',
    };
  }
  return { message: baseMsg, severity: 'success' };
}

export async function changeLifecycleAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const participantId = String(formData.get('participantId') ?? '');
  const newStageId = String(formData.get('newStageId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || null;
  const setLastContacted = formData.get('setLastContacted') === '1';

  if (!participantId) return { ok: false, error: 'missing participantId' };
  if (!newStageId) return { ok: false, error: 'pick a stage' };

  const stage = await getStage(newStageId);
  if (!stage) return { ok: false, error: 'stage not found' };

  let outcome: WritebackOutcome;
  try {
    outcome = await changeLifecycleStage({
      participantId,
      newStageId,
      reason,
      setLastContacted,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath(`/participants/${participantId}`);
  revalidatePath('/participants');
  const desc = describeWriteback(outcome, `Lifecycle updated to ${stage.name}.`);
  return { ok: true, message: desc.message, severity: desc.severity };
}

export async function groupAsFamilyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const primaryId = String(formData.get('primaryId') ?? '');
  const memberIds = formData.getAll('memberIds').map((v) => String(v));

  if (!primaryId) return { ok: false, error: 'missing primaryId' };
  if (memberIds.length === 0) {
    return { ok: false, error: 'pick at least one other participant' };
  }
  const ids = Array.from(new Set([primaryId, ...memberIds]));

  try {
    const result = await groupAsFamily(ids);
    revalidatePath(`/participants/${primaryId}`);
    for (const m of memberIds) revalidatePath(`/participants/${m}`);
    revalidatePath('/participants');

    const skipped = result.writebacks.filter(
      (w) => !w.outcome.ok && w.outcome.reason === 'grace'
    );
    let message = `Grouped ${result.count} participants as ${result.familyGroupId}.`;
    let severity: 'success' | 'warning' = 'success';
    if (skipped.length > 0) {
      message += ` ${skipped.length} sheet writeback${skipped.length === 1 ? '' : 's'} paused due to grace window — will reconcile when grace expires.`;
      severity = 'warning';
    }
    return { ok: true, message, severity };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function unlinkFamilyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const participantId = String(formData.get('participantId') ?? '');
  if (!participantId) return { ok: false, error: 'missing participantId' };
  let outcome: WritebackOutcome;
  try {
    outcome = await unlinkFromFamily(participantId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath(`/participants/${participantId}`);
  revalidatePath('/participants');
  const desc = describeWriteback(outcome, 'Removed from family.');
  return { ok: true, message: desc.message, severity: desc.severity };
}
