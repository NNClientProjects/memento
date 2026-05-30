import { NextResponse } from 'next/server';
import {
  ensureMasterHeaders,
  EXPECTED_HEADERS,
} from '@/integrations/google-sheets/master-sheet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One-shot: writes EXPECTED_HEADERS to row 1 of the master sheet if empty.
// Idempotent — does nothing if row 1 already has values.
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sheetId = process.env.MASTER_SHEET_ID;
  if (!sheetId) {
    return NextResponse.json(
      { error: 'MASTER_SHEET_ID not configured' },
      { status: 500 }
    );
  }

  try {
    await ensureMasterHeaders(sheetId, [...EXPECTED_HEADERS]);
    return NextResponse.json({
      ok: true,
      headers: EXPECTED_HEADERS,
      note: 'Headers ensured. If row 1 already had values, nothing was changed.',
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
