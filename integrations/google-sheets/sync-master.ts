import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeToE164 } from '@/lib/phone';
import { hasWhatsAppRouter } from '@/lib/env';
import {
  extractTrackingFromSheetRow,
  translateSheetValForDb,
  TRACKING_COL_TO_DB,
  TRACKING_COL_NAMES,
  type TranslateContext,
} from '@/lib/sheet-grace';
import {
  upsertParticipantFromSheet,
  upsertReunionAttendee,
  type SheetRowInput,
} from '@/modules/participants/repository';
import { flushPendingWritebacks, type FlushSummary } from '@/modules/participants/services';
import { listStages, getInitialStage } from '@/modules/stages/repository';
import { claimContact, isClaimSkip } from '@/integrations/whatsapp/router';
import { readMasterSheet, type MasterSheetRow } from './master-sheet';

export type SyncSummary = {
  rowsRead: number;
  rowsImported: number;
  rowsSkipped: number;
  inserted: number;
  updated: number;
  trackingColumnsImported: number;
  rowsWithDrift: number;
  rowsInitializedBaseline: number;
  whatsappClaimed: number;
  whatsappClaimsSwapped: number;
  whatsappClaimsSkipped: number;
  whatsappClaimsFailed: number;
  flushedFromQueue: number;
  stillInGrace: number;
  invalidValues: Record<string, number>;
  skipReasons: Record<string, number>;
};

export type SyncOutcome = {
  syncRunId: string;
  eventId: string;
  summary: SyncSummary;
};

function rowToInput(row: MasterSheetRow): SheetRowInput | { skip: string } {
  const full_name = row.fullName?.trim();
  if (!full_name) return { skip: 'no_name' };

  const email = row.email?.trim().toLowerCase() || null;
  const phone_e164 = normalizeToE164(row.whatsappNumber, 'IN');
  if (!email && !phone_e164) return { skip: 'no_email_or_phone' };

  return {
    full_name,
    email,
    phone_e164,
    alt_phone: row.altPhone?.trim() || null,
    current_city: row.currentCity?.trim() || null,
    current_country: row.currentCountry?.trim() || null,
    family_group_id: row.familyGroupId?.trim() || null,
    sheet_row_number: row.rowNumber,
    source: row.source?.trim() || null,
  };
}

async function maybeClaimWhatsApp(
  participantId: string,
  phone: string,
  fullName: string,
  eventId: string,
  eventName: string,
  eventSlug: string,
  summary: SyncSummary
): Promise<void> {
  const db = getSupabaseAdmin();
  const { data: row, error } = await db
    .from('participants')
    .select('whatsapp_claimed_at')
    .eq('id', participantId)
    .single();
  if (error) throw error;
  const claimedAt = (row as { whatsapp_claimed_at: string | null }).whatsapp_claimed_at;
  if (claimedAt) return;

  const result = await claimContact({
    phone,
    metadata: {
      participant_id: participantId,
      full_name: fullName,
      event_name: eventName,
      event_slug: eventSlug,
    },
  });

  if (isClaimSkip(result)) {
    summary.whatsappClaimsSkipped += 1;
    return;
  }
  if (!result.ok) {
    summary.whatsappClaimsFailed += 1;
    await db.from('audit_log').insert({
      event_id: eventId,
      entity_type: 'participant',
      entity_id: participantId,
      action: 'whatsapp_claim_failed',
      after: { phone, error: result.error, status: result.status ?? null },
    });
    return;
  }

  await db
    .from('participants')
    .update({ whatsapp_claimed_at: new Date().toISOString() })
    .eq('id', participantId);

  summary.whatsappClaimed += 1;
  if (result.previous_owner) {
    summary.whatsappClaimsSwapped += 1;
    await db.from('audit_log').insert({
      event_id: eventId,
      entity_type: 'participant',
      entity_id: participantId,
      action: 'whatsapp_claim_swap',
      before: { owner: result.previous_owner },
      after: { owner: result.owner, phone },
    });
  }
}

// Reconciles tracking columns from the sheet against the DB snapshot.
// - Initial baseline (null snapshot): import everything, no drift signal
// - Subsequent: import only the columns that drifted, audit each, mark sheet_edit_detected_at
async function reconcileTrackingForRow(
  participantId: string,
  eventId: string,
  sheetRow: MasterSheetRow,
  summary: SyncSummary,
  translateCtx: TranslateContext
): Promise<void> {
  const db = getSupabaseAdmin();

  const { data: dbRow, error } = await db
    .from('participants')
    .select('sheet_tracking_snapshot, sheet_edit_detected_at')
    .eq('id', participantId)
    .single();
  if (error) throw error;
  const p = dbRow as {
    sheet_tracking_snapshot: Record<string, string> | null;
    sheet_edit_detected_at: string | null;
  };

  const currentSheet = extractTrackingFromSheetRow(sheetRow);
  const snapshot = p.sheet_tracking_snapshot;

  if (!snapshot) {
    // Initial baseline — import everything, no drift event.
    const dbUpdates: Record<string, unknown> = {};
    for (const col of TRACKING_COL_NAMES) {
      const dbCol = TRACKING_COL_TO_DB[col];
      if (!dbCol) continue;
      const translated = translateSheetValForDb(col, currentSheet[col] ?? '', translateCtx);
      if ('skip' in translated) {
        if (translated.skip !== 'no_db_target') {
          summary.invalidValues[translated.skip] =
            (summary.invalidValues[translated.skip] ?? 0) + 1;
        }
        continue;
      }
      dbUpdates[dbCol] = translated.value;
    }
    if (Object.keys(dbUpdates).length > 0) {
      const { error: uErr } = await db
        .from('participants')
        .update(dbUpdates)
        .eq('id', participantId);
      if (uErr) throw uErr;
    }
    await db
      .from('participants')
      .update({
        sheet_tracking_snapshot: currentSheet,
        sheet_tracking_synced_at: new Date().toISOString(),
      })
      .eq('id', participantId);
    summary.rowsInitializedBaseline += 1;
    return;
  }

  const diffs: Array<{ col: string; sheetVal: string; snapVal: string }> = [];
  const dbUpdates: Record<string, unknown> = {};

  for (const col of TRACKING_COL_NAMES) {
    const sheetVal = currentSheet[col] ?? '';
    const snapVal = snapshot[col] ?? '';
    if (sheetVal === snapVal) continue;

    diffs.push({ col, sheetVal, snapVal });

    const dbCol = TRACKING_COL_TO_DB[col];
    if (!dbCol) continue;
    const translated = translateSheetValForDb(col, sheetVal, translateCtx);
    if ('skip' in translated) {
      if (translated.skip !== 'no_db_target') {
        summary.invalidValues[translated.skip] =
          (summary.invalidValues[translated.skip] ?? 0) + 1;
      }
      continue;
    }
    dbUpdates[dbCol] = translated.value;
  }

  if (diffs.length === 0) {
    if (p.sheet_edit_detected_at) {
      await db
        .from('participants')
        .update({ sheet_edit_detected_at: null })
        .eq('id', participantId);
    }
    return;
  }

  summary.rowsWithDrift += 1;
  summary.trackingColumnsImported += Object.keys(dbUpdates).length;

  if (Object.keys(dbUpdates).length > 0) {
    const { error: uErr } = await db
      .from('participants')
      .update(dbUpdates)
      .eq('id', participantId);
    if (uErr) throw uErr;
  }

  await db.from('audit_log').insert({
    event_id: eventId,
    entity_type: 'participant',
    entity_id: participantId,
    action: 'sheet_import',
    before: snapshot,
    after: { diffs },
  });

  const update: Record<string, unknown> = {
    sheet_tracking_snapshot: currentSheet,
  };
  if (!p.sheet_edit_detected_at) {
    update.sheet_edit_detected_at = new Date().toISOString();
  }
  await db.from('participants').update(update).eq('id', participantId);
}

export async function syncMasterSheet(
  eventSlug: string,
  sheetId: string
): Promise<SyncOutcome> {
  const db = getSupabaseAdmin();

  const { data: ev, error: eErr } = await db
    .from('events')
    .select('id')
    .eq('slug', eventSlug)
    .maybeSingle();
  if (eErr) throw eErr;
  if (!ev) throw new Error(`event '${eventSlug}' not found — run seed migration`);
  const eventId = (ev as { id: string }).id;

  const { data: run, error: rErr } = await db
    .from('sync_runs')
    .insert({ event_id: eventId, source: 'master_sheet', status: 'running' })
    .select('id')
    .single();
  if (rErr) throw rErr;
  const syncRunId = (run as { id: string }).id;

  try {
    const { rows } = await readMasterSheet(sheetId);

    const summary: SyncSummary = {
      rowsRead: rows.length,
      rowsImported: 0,
      rowsSkipped: 0,
      inserted: 0,
      updated: 0,
      trackingColumnsImported: 0,
      rowsWithDrift: 0,
      rowsInitializedBaseline: 0,
      whatsappClaimed: 0,
      whatsappClaimsSwapped: 0,
      whatsappClaimsSkipped: 0,
      whatsappClaimsFailed: 0,
      flushedFromQueue: 0,
      stillInGrace: 0,
      invalidValues: {},
      skipReasons: {},
    };

    const { data: ev2 } = await db
      .from('events')
      .select('name')
      .eq('id', eventId)
      .maybeSingle();
    const eventName = (ev2 as { name: string } | null)?.name ?? eventSlug;
    const routerConfigured = hasWhatsAppRouter();

    // Load stages once per sync so the translator can resolve Lifecycle Stage
    // cells against actual stage rows.
    const stages = await listStages(eventId);
    const initial = await getInitialStage(eventId);
    if (!initial) {
      throw new Error(
        `event ${eventSlug} has no initial lifecycle stage. Open /stages and mark one stage as "initial".`
      );
    }
    const translateCtx: TranslateContext = {
      stages,
      initialStageId: initial.id,
    };

    for (const row of rows) {
      const input = rowToInput(row);
      if ('skip' in input) {
        summary.rowsSkipped += 1;
        summary.skipReasons[input.skip] =
          (summary.skipReasons[input.skip] ?? 0) + 1;
        continue;
      }
      const result = await upsertParticipantFromSheet(eventId, input);
      summary.rowsImported += 1;
      if (result.isNew) summary.inserted += 1;
      else summary.updated += 1;

      await upsertReunionAttendee(result.id, {
        batch: row.batch ? Number(row.batch) || null : null,
        dorm: row.dormName?.trim() || null,
        dorm_number: row.dormNumber?.trim() || null,
        section: row.section?.trim() || null,
        spouse_name: row.spouseName?.trim() || null,
        spouse_dorm: row.spouseDorm?.trim() || null,
        spouse_dorm_number: row.spouseDormNumber?.trim() || null,
      });

      await reconcileTrackingForRow(result.id, eventId, row, summary, translateCtx);

      if (routerConfigured && input.phone_e164) {
        await maybeClaimWhatsApp(
          result.id,
          input.phone_e164,
          input.full_name,
          eventId,
          eventName,
          eventSlug,
          summary
        );
      }
    }

    const flush: FlushSummary = await flushPendingWritebacks(eventId);
    summary.flushedFromQueue = flush.flushed;
    summary.stillInGrace = flush.stillInGrace;

    await db
      .from('sync_runs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        summary,
      })
      .eq('id', syncRunId);

    return { syncRunId, eventId, summary };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .from('sync_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: msg,
      })
      .eq('id', syncRunId);
    throw err;
  }
}
