import { google } from 'googleapis';
import { getSheetsAuth } from '@/lib/google-auth';

const READ_RANGE = 'A:AZ';

export type MasterSheetRow = {
  rowNumber: number;
  srNo?: string;
  fullName?: string;
  email?: string;
  whatsappNumber?: string;
  altPhone?: string;
  batch?: string;
  dormName?: string;
  dormNumber?: string;
  section?: string;
  currentCity?: string;
  currentCountry?: string;
  spouseName?: string;
  spouseDorm?: string;
  spouseDormNumber?: string;
  familyGroupId?: string;
  lifecycleStage?: string;
  assignedOrganiser?: string;
  lastContactedDate?: string;
  lastContactedChannel?: string;
  formSubmitted?: string;
  advancePaid?: string;
  selfReportedStatus?: string;
  notes?: string;
  updatedAt?: string;
  source?: string;
  addedBy?: string;
  addedDate?: string;
};

const HEADER_MAP: Record<string, keyof MasterSheetRow> = {
  'Sr No': 'srNo',
  'Full Name': 'fullName',
  Email: 'email',
  'WhatsApp Number': 'whatsappNumber',
  'Alt Phone': 'altPhone',
  Batch: 'batch',
  'Dorm Name': 'dormName',
  'Dorm Number': 'dormNumber',
  Section: 'section',
  'Current City': 'currentCity',
  'Current Country': 'currentCountry',
  'Spouse Name': 'spouseName',
  'Spouse Dorm': 'spouseDorm',
  'Spouse Dorm Number': 'spouseDormNumber',
  'Family Group ID': 'familyGroupId',
  'Lifecycle Stage': 'lifecycleStage',
  'Assigned Organiser': 'assignedOrganiser',
  'Last Contacted Date': 'lastContactedDate',
  'Last Contacted Channel': 'lastContactedChannel',
  'Form Submitted': 'formSubmitted',
  'Advance Paid': 'advancePaid',
  'Self-Reported Final Status': 'selfReportedStatus',
  Notes: 'notes',
  'Updated At': 'updatedAt',
  Source: 'source',
  'Added By': 'addedBy',
  'Added Date': 'addedDate',
};

export const TRACKING_HEADERS = [
  'Lifecycle Stage',
  'Assigned Organiser',
  'Last Contacted Date',
  'Last Contacted Channel',
  'Form Submitted',
  'Advance Paid',
  'Self-Reported Final Status',
  'Notes',
  'Updated At',
  'Family Group ID',
] as const;

// Ordered for human use in the Sheet: identity → context → family → tracking → provenance.
export const EXPECTED_HEADERS = [
  'Sr No',
  'Full Name',
  'Email',
  'WhatsApp Number',
  'Alt Phone',
  'Batch',
  'Dorm Name',
  'Dorm Number',
  'Section',
  'Current City',
  'Current Country',
  'Spouse Name',
  'Spouse Dorm',
  'Spouse Dorm Number',
  'Family Group ID',
  'Lifecycle Stage',
  'Assigned Organiser',
  'Last Contacted Date',
  'Last Contacted Channel',
  'Form Submitted',
  'Advance Paid',
  'Self-Reported Final Status',
  'Notes',
  'Updated At',
  'Source',
  'Added By',
  'Added Date',
] as const;

export async function readMasterSheet(sheetId: string): Promise<{
  rows: MasterSheetRow[];
  headers: string[];
}> {
  const auth = getSheetsAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: READ_RANGE,
  });

  const values = res.data.values ?? [];
  if (values.length === 0) return { rows: [], headers: [] };

  const headers = values[0].map((h) => String(h ?? '').trim());
  const fieldNames = headers.map((h) => HEADER_MAP[h] ?? null);

  const rows = values.slice(1).map((row, idx) => {
    const out: MasterSheetRow = { rowNumber: idx + 2 };
    row.forEach((cell, colIdx) => {
      const field = fieldNames[colIdx];
      if (field && cell != null && cell !== '') {
        (out as Record<string, unknown>)[field] = String(cell);
      }
    });
    return out;
  });

  return { rows, headers };
}

function columnLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function writeTrackingColumns(
  sheetId: string,
  rowNumber: number,
  headers: string[],
  updates: Partial<Record<(typeof TRACKING_HEADERS)[number], string>>
): Promise<void> {
  const auth = getSheetsAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const data: { range: string; values: string[][] }[] = [];
  for (const [header, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const colIdx = headers.indexOf(header);
    if (colIdx === -1) continue;
    data.push({
      range: `${columnLetter(colIdx)}${rowNumber}`,
      values: [[value]],
    });
  }
  if (data.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
}

// Convenience wrapper that fetches row-1 headers, then writes a single row's tracking
// columns. Used by mutation services so callers don't need to plumb headers through.
export async function writebackToSheet(
  sheetId: string,
  rowNumber: number,
  updates: Partial<Record<(typeof TRACKING_HEADERS)[number], string>>
): Promise<void> {
  const auth = getSheetsAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: '1:1',
  });
  const headers = (res.data.values?.[0] ?? []).map((h) => String(h ?? '').trim());
  if (headers.length === 0) {
    throw new Error('sheet has no header row — run /api/sheets/init first');
  }
  await writeTrackingColumns(sheetId, rowNumber, headers, updates);
}

export async function ensureMasterHeaders(
  sheetId: string,
  expectedHeaders: string[]
): Promise<void> {
  const auth = getSheetsAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: '1:1',
  });
  const currentHeaders = existing.data.values?.[0] ?? [];
  if (currentHeaders.length > 0) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values: [expectedHeaders] },
  });
}
