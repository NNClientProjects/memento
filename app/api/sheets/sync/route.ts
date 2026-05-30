import { NextResponse } from 'next/server';
import { syncMasterSheet } from '@/integrations/google-sheets/sync-master';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_EVENT_SLUG = 'reunion-2026';

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

  const url = new URL(request.url);
  const eventSlug = url.searchParams.get('event') ?? DEFAULT_EVENT_SLUG;

  try {
    const outcome = await syncMasterSheet(eventSlug, sheetId);
    return NextResponse.json({ ok: true, ...outcome });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
