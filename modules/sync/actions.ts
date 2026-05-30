'use server';

import { revalidatePath } from 'next/cache';
import { syncMasterSheet } from '@/integrations/google-sheets/sync-master';
import {
  flushPendingWritebacks,
  type FlushSummary,
} from '@/modules/participants/services';
import { currentEventSlug, getCurrentEventId } from '@/lib/event-context';

export type SyncActionResult =
  | {
      ok: true;
      message: string;
      summary: Awaited<ReturnType<typeof syncMasterSheet>>['summary'];
      severity: 'success' | 'warning';
    }
  | { ok: false; error: string };

export async function syncNowAction(
  _prev: SyncActionResult | null,
  _formData: FormData
): Promise<SyncActionResult> {
  const sheetId = process.env.MASTER_SHEET_ID;
  if (!sheetId) {
    return { ok: false, error: 'MASTER_SHEET_ID not configured' };
  }
  try {
    const outcome = await syncMasterSheet(currentEventSlug(), sheetId);
    const s = outcome.summary;
    const hadInvalid = Object.keys(s.invalidValues).length > 0;
    const hadSkips = Object.keys(s.skipReasons).length > 0;
    const severity: 'success' | 'warning' =
      hadInvalid || hadSkips ? 'warning' : 'success';

    const parts: string[] = [];
    parts.push(`${s.rowsImported}/${s.rowsRead} rows imported`);
    if (s.inserted) parts.push(`${s.inserted} new`);
    if (s.updated) parts.push(`${s.updated} updated`);
    if (s.rowsInitializedBaseline)
      parts.push(`${s.rowsInitializedBaseline} initialized`);
    if (s.rowsWithDrift) parts.push(`${s.rowsWithDrift} with drift`);
    if (s.trackingColumnsImported)
      parts.push(`${s.trackingColumnsImported} cols imported`);
    if (s.rowsSkipped) parts.push(`${s.rowsSkipped} rows skipped`);
    if (hadInvalid)
      parts.push(`${Object.keys(s.invalidValues).length} invalid value(s)`);

    revalidatePath('/');
    revalidatePath('/participants');

    return {
      ok: true,
      message: `Sync complete: ${parts.join(' · ')}.`,
      summary: s,
      severity,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type ReconcileResult =
  | { ok: true; message: string; summary: FlushSummary; severity: 'success' | 'warning' }
  | { ok: false; error: string };

export async function reconcileNowAction(
  _prev: ReconcileResult | null,
  _formData: FormData
): Promise<ReconcileResult> {
  try {
    const eventId = await getCurrentEventId();
    const flush = await flushPendingWritebacks(eventId);
    revalidatePath('/');
    revalidatePath('/participants');

    const parts: string[] = [];
    parts.push(`${flush.flushed}/${flush.attempted} flushed`);
    if (flush.stillInGrace) parts.push(`${flush.stillInGrace} still in grace`);
    if (flush.noSheet) parts.push(`${flush.noSheet} no sheet`);
    if (flush.failed) parts.push(`${flush.failed} failed`);

    const severity: 'success' | 'warning' =
      flush.failed > 0 || flush.stillInGrace > 0 ? 'warning' : 'success';

    return {
      ok: true,
      message:
        flush.attempted === 0
          ? 'No pending writebacks to flush.'
          : `Reconciled: ${parts.join(' · ')}.`,
      summary: flush,
      severity,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
