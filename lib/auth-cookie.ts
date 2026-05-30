// Shared auth helpers for the password gate.
// Uses Web Crypto so this module is safe in both Node runtime (server actions)
// and Edge runtime (proxy.ts).

export const AUTH_COOKIE_NAME = 'memento_session';
export const AUTH_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

export function authConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.AUTH_COOKIE_SECRET);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Deterministic per (password, secret). Same hash for every authenticated user
// — this is a shared-password gate, not per-user auth.
export async function expectedCookieValue(): Promise<string> {
  const pw = process.env.ADMIN_PASSWORD;
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!pw || !secret) return '';
  return sha256Hex(`${pw}|${secret}`);
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyAuthCookie(
  cookieValue: string | undefined | null
): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await expectedCookieValue();
  if (!expected) return false;
  return constantTimeEquals(cookieValue, expected);
}
