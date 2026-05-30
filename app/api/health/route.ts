import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'event-mgmt-app',
    time: new Date().toISOString(),
  });
}
