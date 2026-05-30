import { getSupabaseAdmin } from '@/lib/supabase';
import { writebackToSheet } from '@/integrations/google-sheets/master-sheet';
import { isInGraceWindow } from '@/lib/sheet-grace';
import { getStage } from '@/modules/stages/repository';
import type { Stage } from '@/modules/stages/types';
import type { Participant } from './types';

export type LifecycleHistoryEntry = {
  id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  reason: string | null;
  changed_at: string;
  from_stage: Stage | null;
  to_stage: Stage | null;
};

export async function getLifecycleHistory(
  participantId: string,
  limit = 20
): Promise<LifecycleHistoryEntry[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('lifecycle_history')
    .select(
      'id, from_stage_id, to_stage_id, reason, changed_at, from_stage:lifecycle_stages!lifecycle_history_from_stage_id_fkey(*), to_stage:lifecycle_stages!lifecycle_history_to_stage_id_fkey(*)'
    )
    .eq('participant_id', participantId)
    .order('changed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  type Raw = {
    id: string;
    from_stage_id: string | null;
    to_stage_id: string;
    reason: string | null;
    changed_at: string;
    from_stage: Stage | Stage[] | null;
    to_stage: Stage | Stage[] | null;
  };
  return ((data ?? []) as Raw[]).map((r) => ({
    id: r.id,
    from_stage_id: r.from_stage_id,
    to_stage_id: r.to_stage_id,
    reason: r.reason,
    changed_at: r.changed_at,
    from_stage: Array.isArray(r.from_stage)
      ? (r.from_stage[0] ?? null)
      : r.from_stage,
    to_stage: Array.isArray(r.to_stage) ? (r.to_stage[0] ?? null) : r.to_stage,
  }));
}

export async function listFamilyMembers(
  eventId: string,
  familyGroupId: string
): Promise<Participant[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('participants')
    .select('*')
    .eq('event_id', eventId)
    .eq('family_group_id', familyGroupId)
    .order('full_name');
  if (error) throw error;
  return (data ?? []) as Participant[];
}

export async function listFamilyCandidates(
  eventId: string,
  excludeId: string
): Promise<Participant[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('participants')
    .select('*')
    .eq('event_id', eventId)
    .is('family_group_id', null)
    .neq('id', excludeId)
    .order('full_name')
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Participant[];
}

// Tracking-aware writeback: checks the 5-min grace window before pushing to the Sheet,
// updates snapshot + synced_at on success, audits skips and writes.
export type WritebackOutcome =
  | { ok: true; written: string[] }
  | { ok: false; reason: 'grace' | 'no_sheet_row' | 'no_sheet_id'; pendingUntil?: string };

type TrackingUpdates = Partial<{
  'Lifecycle Stage': string;
  'Last Contacted Date': string;
  'Last Contacted Channel': string;
  Notes: string;
  'Family Group ID': string;
  'Updated At': string;
}>;

export async function writebackParticipantTracking(
  participantId: string,
  updates: TrackingUpdates
): Promise<WritebackOutcome> {
  const db = getSupabaseAdmin();
  const sheetId = process.env.MASTER_SHEET_ID;
  if (!sheetId) return { ok: false, reason: 'no_sheet_id' };

  const { data: rowRaw, error } = await db
    .from('participants')
    .select(
      'id, event_id, sheet_row_number, sheet_tracking_snapshot, sheet_edit_detected_at'
    )
    .eq('id', participantId)
    .single();
  if (error) throw error;
  const p = rowRaw as {
    id: string;
    event_id: string;
    sheet_row_number: number | null;
    sheet_tracking_snapshot: Record<string, string> | null;
    sheet_edit_detected_at: string | null;
  };

  if (!p.sheet_row_number) return { ok: false, reason: 'no_sheet_row' };

  if (isInGraceWindow(p.sheet_edit_detected_at)) {
    const pendingUntil = new Date(
      new Date(p.sheet_edit_detected_at!).getTime() + 5 * 60 * 1000
    ).toISOString();

    const { data: existing } = await db
      .from('pending_writebacks')
      .select('updates')
      .eq('participant_id', participantId)
      .maybeSingle();
    const merged = {
      ...((existing as { updates: Record<string, string> } | null)?.updates ?? {}),
      ...updates,
    };
    await db.from('pending_writebacks').upsert(
      {
        participant_id: participantId,
        event_id: p.event_id,
        updates: merged,
        queued_at: new Date().toISOString(),
      },
      { onConflict: 'participant_id' }
    );

    await db.from('audit_log').insert({
      event_id: p.event_id,
      entity_type: 'participant',
      entity_id: participantId,
      action: 'writeback_skipped',
      after: {
        reason: 'grace_window_active',
        detected_at: p.sheet_edit_detected_at,
        attempted: updates,
        queued: true,
      },
    });
    return { ok: false, reason: 'grace', pendingUntil };
  }

  await writebackToSheet(sheetId, p.sheet_row_number, updates);

  const newSnapshot = { ...(p.sheet_tracking_snapshot ?? {}), ...updates };
  const now = new Date().toISOString();
  const { error: uErr } = await db
    .from('participants')
    .update({
      sheet_tracking_snapshot: newSnapshot,
      sheet_tracking_synced_at: now,
      sheet_edit_detected_at: null,
    })
    .eq('id', participantId);
  if (uErr) throw uErr;

  // Once writeback succeeds, clear any pending queue row for this participant.
  await db
    .from('pending_writebacks')
    .delete()
    .eq('participant_id', participantId);

  await db.from('audit_log').insert({
    event_id: p.event_id,
    entity_type: 'participant',
    entity_id: participantId,
    action: 'writeback',
    after: { columns: Object.keys(updates), values: updates },
  });

  return { ok: true, written: Object.keys(updates) };
}

export type FlushSummary = {
  attempted: number;
  flushed: number;
  stillInGrace: number;
  failed: number;
  noSheet: number;
};

// Drains the pending_writebacks queue for an event (or all events).
// Calls writebackParticipantTracking, which re-checks grace.
// Successful writes delete the row; still-in-grace rows stay; failures bump attempts.
export async function flushPendingWritebacks(
  eventId?: string
): Promise<FlushSummary> {
  const db = getSupabaseAdmin();

  let q = db.from('pending_writebacks').select('*');
  if (eventId) q = q.eq('event_id', eventId);
  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    participant_id: string;
    updates: TrackingUpdates;
    attempts: number;
  }>;

  const summary: FlushSummary = {
    attempted: rows.length,
    flushed: 0,
    stillInGrace: 0,
    failed: 0,
    noSheet: 0,
  };

  for (const row of rows) {
    try {
      const outcome = await writebackParticipantTracking(
        row.participant_id,
        row.updates
      );
      if (outcome.ok) {
        summary.flushed += 1;
        // writebackParticipantTracking already deleted the row on success
      } else if (outcome.reason === 'grace') {
        summary.stillInGrace += 1;
      } else {
        summary.noSheet += 1;
        await db
          .from('pending_writebacks')
          .update({
            attempts: row.attempts + 1,
            last_attempt_at: new Date().toISOString(),
            last_error: outcome.reason,
          })
          .eq('participant_id', row.participant_id);
      }
    } catch (err) {
      summary.failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      await db
        .from('pending_writebacks')
        .update({
          attempts: row.attempts + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: msg,
        })
        .eq('participant_id', row.participant_id);
    }
  }

  return summary;
}

export type LifecycleChangeOptions = {
  participantId: string;
  newStageId: string;
  reason?: string | null;
  setLastContacted?: boolean;
};

export async function changeLifecycleStage(
  opts: LifecycleChangeOptions
): Promise<WritebackOutcome> {
  const db = getSupabaseAdmin();

  const { data: current, error: cErr } = await db
    .from('participants')
    .select('*')
    .eq('id', opts.participantId)
    .single();
  if (cErr) throw cErr;
  const p = current as Participant;

  if (p.lifecycle_stage_id === opts.newStageId && !opts.setLastContacted) {
    return { ok: true, written: [] };
  }

  const newStage = await getStage(opts.newStageId);
  if (!newStage) throw new Error(`stage ${opts.newStageId} not found`);
  if (newStage.event_id !== p.event_id) {
    throw new Error('stage belongs to a different event');
  }

  const now = new Date().toISOString();
  const fromStageId = p.lifecycle_stage_id;

  await db.from('lifecycle_history').insert({
    participant_id: opts.participantId,
    from_stage_id: fromStageId,
    to_stage_id: opts.newStageId,
    reason: opts.reason ?? null,
    changed_at: now,
  });

  const updates: Record<string, unknown> = {
    lifecycle_stage_id: opts.newStageId,
  };
  if (fromStageId !== opts.newStageId) {
    updates.entered_current_stage_at = now;
  }
  if (opts.setLastContacted) updates.last_contacted_at = now;
  const { error: uErr } = await db
    .from('participants')
    .update(updates)
    .eq('id', opts.participantId);
  if (uErr) throw uErr;

  await db.from('audit_log').insert({
    event_id: p.event_id,
    entity_type: 'participant',
    entity_id: opts.participantId,
    action: 'lifecycle_change',
    before: { lifecycle_stage_id: fromStageId },
    after: {
      lifecycle_stage_id: opts.newStageId,
      stage_name: newStage.name,
      reason: opts.reason ?? null,
    },
  });

  const sheetUpdates: TrackingUpdates = {
    'Lifecycle Stage': newStage.name,
    'Updated At': now,
  };
  if (opts.setLastContacted) sheetUpdates['Last Contacted Date'] = now;
  return writebackParticipantTracking(opts.participantId, sheetUpdates);
}

async function nextFamilyGroupId(eventId: string): Promise<string> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('participants')
    .select('family_group_id')
    .eq('event_id', eventId)
    .not('family_group_id', 'is', null);
  if (error) throw error;

  let maxN = 0;
  for (const row of data ?? []) {
    const id = (row as { family_group_id: string | null }).family_group_id;
    if (!id) continue;
    const m = id.match(/^F-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxN) maxN = n;
    }
  }
  return `F-${String(maxN + 1).padStart(4, '0')}`;
}

export type GroupAsFamilyResult = {
  familyGroupId: string;
  count: number;
  writebacks: Array<{ participantId: string; outcome: WritebackOutcome }>;
};

export async function groupAsFamily(
  participantIds: string[]
): Promise<GroupAsFamilyResult> {
  if (participantIds.length < 2) {
    throw new Error('need at least 2 participants to group as family');
  }
  const db = getSupabaseAdmin();

  const { data: rows, error: rErr } = await db
    .from('participants')
    .select('*')
    .in('id', participantIds);
  if (rErr) throw rErr;
  const participants = (rows ?? []) as Participant[];

  if (participants.length !== participantIds.length) {
    throw new Error('one or more participants not found');
  }
  const eventIds = new Set(participants.map((p) => p.event_id));
  if (eventIds.size > 1) {
    throw new Error('participants must all be in the same event');
  }
  const eventId = participants[0].event_id;

  const already = participants.filter((p) => p.family_group_id);
  if (already.length > 0) {
    throw new Error(
      `already in a family group: ${already.map((p) => p.full_name).join(', ')} — unlink first`
    );
  }

  const familyGroupId = await nextFamilyGroupId(eventId);

  const { error: uErr } = await db
    .from('participants')
    .update({ family_group_id: familyGroupId })
    .in('id', participantIds);
  if (uErr) throw uErr;

  await db.from('audit_log').insert({
    event_id: eventId,
    entity_type: 'family_group',
    entity_id: participantIds[0],
    action: 'family_merge',
    after: {
      family_group_id: familyGroupId,
      members: participants.map((p) => ({ id: p.id, name: p.full_name })),
    },
  });

  const now = new Date().toISOString();
  const writebacks: GroupAsFamilyResult['writebacks'] = [];
  for (const p of participants) {
    const outcome = await writebackParticipantTracking(p.id, {
      'Family Group ID': familyGroupId,
      'Updated At': now,
    });
    writebacks.push({ participantId: p.id, outcome });
  }

  return { familyGroupId, count: participants.length, writebacks };
}

export async function unlinkFromFamily(
  participantId: string
): Promise<WritebackOutcome> {
  const db = getSupabaseAdmin();

  const { data: row, error: rErr } = await db
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .single();
  if (rErr) throw rErr;
  const p = row as Participant;

  if (!p.family_group_id) return { ok: true, written: [] };
  const previousId = p.family_group_id;

  const { error: uErr } = await db
    .from('participants')
    .update({ family_group_id: null })
    .eq('id', participantId);
  if (uErr) throw uErr;

  await db.from('audit_log').insert({
    event_id: p.event_id,
    entity_type: 'participant',
    entity_id: participantId,
    action: 'family_unlink',
    before: { family_group_id: previousId },
    after: { family_group_id: null },
  });

  return writebackParticipantTracking(participantId, {
    'Family Group ID': '',
    'Updated At': new Date().toISOString(),
  });
}
