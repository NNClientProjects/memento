import { google } from 'googleapis';
import { getGmailAuth } from '@/lib/google-auth';

export type SendEmailParams = {
  to: string;
  subject: string;
  body: string;
  from?: string;
  bodyType?: 'html' | 'plain';
};

export type SendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const auth = getGmailAuth();
    const gmail = google.gmail({ version: 'v1', auth });

    const contentType =
      params.bodyType === 'plain' ? 'text/plain' : 'text/html';

    const headers = [
      params.from ? `From: ${params.from}` : null,
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      `Content-Type: ${contentType}; charset=utf-8`,
      'MIME-Version: 1.0',
    ].filter(Boolean);

    const raw = [...headers, '', params.body].join('\r\n');

    const encoded = Buffer.from(raw, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded },
    });

    if (!res.data.id) return { ok: false, error: 'no message id returned' };
    return { ok: true, messageId: res.data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
