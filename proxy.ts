// Next.js 16 proxy (was "middleware" pre-16). Runs at the edge before requests
// reach pages or route handlers. Used here as a shared-password gate.

import { NextResponse, type NextRequest } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  authConfigured,
  verifyAuthCookie,
} from './lib/auth-cookie';

// Paths that bypass the auth gate. Order matters for prefix matches.
const PUBLIC_PATHS = [
  '/login',
  '/u/', // unsubscribe link confirmation pages
  '/api/health',
  '/api/sheets/sync', // already gated by CRON_SECRET
  '/api/sheets/init', // already gated by CRON_SECRET
  '/api/whatsapp/inbound', // already gated by INBOUND_FORWARD_SECRET
];

function isPublic(pathname: string): boolean {
  for (const p of PUBLIC_PATHS) {
    if (pathname === p) return true;
    if (p.endsWith('/') && pathname.startsWith(p)) return true;
    if (!p.endsWith('/') && pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  if (!authConfigured()) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (await verifyAuthCookie(cookie)) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  if (pathname !== '/') {
    loginUrl.searchParams.set('next', pathname + search);
  }
  return NextResponse.redirect(loginUrl);
}

// Skip static assets so the gate isn't doing crypto work on every CSS/JS request.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)'],
};
