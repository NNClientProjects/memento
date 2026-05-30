'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE_S,
  expectedCookieValue,
} from '@/lib/auth-cookie';

export type LoginResult = { ok: false; error: string } | { ok: true };

export async function loginAction(
  _prev: LoginResult | null,
  formData: FormData
): Promise<LoginResult> {
  const pw = String(formData.get('password') ?? '');
  const nextPath = String(formData.get('next') ?? '/') || '/';

  const adminPw = process.env.ADMIN_PASSWORD;
  const secret = process.env.AUTH_COOKIE_SECRET;

  if (!adminPw || !secret) {
    return {
      ok: false,
      error:
        'auth not configured (set ADMIN_PASSWORD and AUTH_COOKIE_SECRET in env)',
    };
  }
  if (pw !== adminPw) {
    return { ok: false, error: 'wrong password' };
  }

  const value = await expectedCookieValue();
  const jar = await cookies();
  jar.set({
    name: AUTH_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_S,
  });

  redirect(nextPath.startsWith('/') ? nextPath : '/');
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE_NAME);
  redirect('/login');
}
