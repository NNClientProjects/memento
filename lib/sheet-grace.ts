import { COMM_CHANNELS, type CommChannel } from './lifecycle';
import type { MasterSheetRow } from '@/integrations/google-sheets/master-sheet';
import type { Stage } from '@/modules/stages/types';

export const GRACE_WINDOW_MS = 5 * 60 * 1000;

export function isInGraceWindow(
  detectedAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!detectedAt) return false;
  return now.getTime() - new Date(detectedAt).getTime() < GRACE_WINDOW_MS;
}

// Tracking columns we read from sheet → import into DB.
// Keys are sheet header names; values are participant DB column names
// (null = no DB target yet).
export const TRACKING_COL_TO_DB: Record<string, string | null> = {
  'Lifecycle Stage': 'lifecycle_stage_id',
  'Assigned Organiser': null,
  'Last Contacted Date': 'last_contacted_at',
  'Last Contacted Channel': 'last_contacted_channel',
  'Form Submitted': null,
  'Advance Paid': null,
  'Self-Reported Final Status': 'self_reported_status',
  Notes: 'notes',
  'Updated At': null, // app-owned timestamp; do not import organiser edits to it
  'Family Group ID': 'family_group_id',
};

export const TRACKING_COL_NAMES = Object.keys(TRACKING_COL_TO_DB);

// Extracts a normalized record of {Sheet header → string} from a parsed sheet row.
// Empty strings are normalized to '' (not null) so snapshot diffs are stable.
export function extractTrackingFromSheetRow(
  row: MasterSheetRow
): Record<string, string> {
  return {
    'Lifecycle Stage': (row.lifecycleStage ?? '').trim(),
    'Assigned Organiser': (row.assignedOrganiser ?? '').trim(),
    'Last Contacted Date': (row.lastContactedDate ?? '').trim(),
    'Last Contacted Channel': (row.lastContactedChannel ?? '').trim(),
    'Form Submitted': (row.formSubmitted ?? '').trim(),
    'Advance Paid': (row.advancePaid ?? '').trim(),
    'Self-Reported Final Status': (row.selfReportedStatus ?? '').trim(),
    Notes: (row.notes ?? '').trim(),
    'Updated At': (row.updatedAt ?? '').trim(),
    'Family Group ID': (row.familyGroupId ?? '').trim(),
  };
}

export type TranslateContext = {
  stages: Stage[];          // per-event stages, for Lifecycle Stage resolution
  initialStageId: string;   // fallback for blank cells
};

// Translate a raw sheet cell value into the right DB type for a given tracking column.
// Returns { value, dbColumn? } if importable, or { skip: reason } if it should be ignored.
// Lifecycle Stage cells are matched case-insensitively against stage name OR slug.
export function translateSheetValForDb(
  col: string,
  sheetValue: string,
  ctx: TranslateContext
): { value: unknown } | { skip: string } {
  const trimmed = sheetValue.trim();

  switch (col) {
    case 'Lifecycle Stage': {
      if (!trimmed) return { value: ctx.initialStageId };
      const lower = trimmed.toLowerCase();
      const match = ctx.stages.find(
        (s) => s.slug === trimmed || s.name.toLowerCase() === lower
      );
      if (!match) return { skip: `invalid_lifecycle_stage:${trimmed}` };
      return { value: match.id };
    }
    case 'Last Contacted Channel': {
      if (!trimmed) return { value: null };
      const lower = trimmed.toLowerCase();
      if (!(COMM_CHANNELS as readonly string[]).includes(lower)) {
        return { skip: `invalid_comm_channel:${trimmed}` };
      }
      return { value: lower as CommChannel };
    }
    case 'Last Contacted Date': {
      if (!trimmed) return { value: null };
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) return { skip: `invalid_date:${trimmed}` };
      return { value: d.toISOString() };
    }
    case 'Family Group ID':
    case 'Notes':
    case 'Self-Reported Final Status': {
      return { value: trimmed || null };
    }
    default:
      return { skip: 'no_db_target' };
  }
}
