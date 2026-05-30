import { NextResponse } from 'next/server';
import { getOAuth2Client } from '@/lib/google-auth';

export const runtime = 'nodejs';

function htmlPage(title: string, body: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .small { color: #666; font-size: 0.875rem; }
    .ok { color: #16a34a; }
    .err { color: #dc2626; }
    code { font-family: ui-monospace, monospace; font-size: 0.875rem; }
    .box { margin: 1rem 0; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; background: #f8f8f8; }
    .token { display: block; word-break: break-all; padding: 0.5rem; background: #fff; border: 1px solid #ddd; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 0.875rem; user-select: all; cursor: text; }
    .copy-btn { margin-top: 0.5rem; padding: 0.375rem 0.75rem; background: #111; color: #fff; border: 0; border-radius: 6px; font-size: 0.875rem; cursor: pointer; }
    .copy-btn:hover { background: #333; }
    ol li { margin: 0.5rem 0; }
    @media (prefers-color-scheme: dark) {
      body { background: #0a0a0a; color: #e5e5e5; }
      .box { background: #18181b; border-color: #333; }
      .token { background: #0a0a0a; border-color: #333; }
      .small { color: #999; }
    }
  </style>
</head>
<body>
  ${body}
  <p class="small" style="margin-top:2rem"><a href="/">← Back to setup</a></p>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const errParam = url.searchParams.get('error');

  if (errParam) {
    return htmlPage(
      'OAuth error',
      `<h1 class="err">OAuth error</h1><p>Google returned <code>${errParam}</code>. Try again from <a href="/api/auth/google">/api/auth/google</a>.</p>`,
      400
    );
  }
  if (!code) {
    return htmlPage(
      'Missing code',
      `<h1 class="err">Missing authorization code</h1><p>Go back to <a href="/api/auth/google">/api/auth/google</a> to retry.</p>`,
      400
    );
  }

  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return htmlPage(
        'No refresh token',
        `<h1 class="err">Google didn't return a refresh token</h1>
         <p>This usually means you've consented to this app before. Either:</p>
         <ul>
           <li>Revoke this app's access at <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a>, then retry <a href="/api/auth/google">/api/auth/google</a></li>
           <li>Or use the existing refresh token from your previous bootstrap (check your <code>.env</code>)</li>
         </ul>`,
        500
      );
    }

    const body = `
      <h1 class="ok">✓ Google connected</h1>
      <p class="small">One-time bootstrap. Copy the refresh token below and paste it into your <code>.env</code> file, then restart <code>npm run dev</code>.</p>
      <div class="box">
        <p style="margin:0 0 0.5rem"><strong>GOOGLE_SHEETS_REFRESH_TOKEN</strong> — paste this into <code>.env</code>:</p>
        <code class="token" id="token">${refreshToken}</code>
        <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('token').textContent); this.textContent='Copied ✓'">Copy to clipboard</button>
      </div>
      <ol class="small">
        <li>Open <code>.env</code> (in the project root).</li>
        <li>Find or add the line: <code>GOOGLE_SHEETS_REFRESH_TOKEN=</code></li>
        <li>Paste the value after the <code>=</code> sign (no quotes needed).</li>
        <li>Save the file.</li>
        <li>Stop and restart <code>npm run dev</code>.</li>
        <li>Refresh the setup page — Gmail send should now show as ready.</li>
      </ol>
      <p class="small">Granted scopes: <code>${tokens.scope ?? '(none)'}</code></p>
    `;

    return htmlPage('Google connected', body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return htmlPage(
      'Token exchange failed',
      `<h1 class="err">Token exchange failed</h1><p><code>${msg}</code></p><p>Try again from <a href="/api/auth/google">/api/auth/google</a>.</p>`,
      500
    );
  }
}

export async function POST(): Promise<Response> {
  return NextResponse.json({ error: 'use GET' }, { status: 405 });
}
