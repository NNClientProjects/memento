import { NextResponse } from 'next/server';
import { runAutomations } from '@/modules/rules/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cron-callable runner for the rules engine. Protected by CRON_SECRET.
// In production wire this to Vercel Cron (e.g., hourly). Also called by the
// "Run automations now" button on /setup via a server action.
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const summary = await runAutomations();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
