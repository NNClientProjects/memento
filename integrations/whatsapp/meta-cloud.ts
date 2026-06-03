// Meta WhatsApp Cloud API client — direct outbound, no AiSensy.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
//
// Uses a long-lived system-user access token. Sending a template requires the
// template name and one positional parameter per {{1}}, {{2}}, ... placeholder
// the template was approved with.

import { hasMetaWhatsApp } from '@/lib/env';

const META_API_VERSION = 'v23.0';

export type MetaTemplateParams = {
  // Template's Meta-approved name (lowercase_with_underscores).
  templateName: string;
  // BCP-47 language code Meta has the template in (e.g., 'en', 'en_US', 'hi').
  languageCode: string;
  // Recipient phone in E.164 with leading + (e.g., '+919876543210') — we strip
  // the + before sending. Must have opted in or be the test number Meta seeded.
  to: string;
  // Positional substitutions for {{1}}, {{2}}, ... Empty array if template has none.
  bodyParameters: string[];
};

export type MetaSendResult =
  | { ok: true; messageId: string; waId: string }
  | { ok: false; error: string; status?: number };

export type MetaSendSkip = {
  ok: false;
  skipped: true;
  reason: 'meta_not_configured';
};

export function isMetaSendSkip(
  r: MetaSendResult | MetaSendSkip
): r is MetaSendSkip {
  return r.ok === false && (r as MetaSendSkip).skipped === true;
}

export async function sendWhatsAppTemplate(
  params: MetaTemplateParams
): Promise<MetaSendResult | MetaSendSkip> {
  if (!hasMetaWhatsApp()) {
    return { ok: false, skipped: true, reason: 'meta_not_configured' };
  }
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN!;

  const digits = params.to.replace(/\D/g, '');
  if (digits.length < 7) {
    return { ok: false, error: `invalid recipient phone: ${params.to}` };
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`;
  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to: digits,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.languageCode },
      ...(params.bodyParameters.length > 0
        ? {
            components: [
              {
                type: 'body',
                parameters: params.bodyParameters.map((p) => ({
                  type: 'text',
                  text: p,
                })),
              },
            ],
          }
        : {}),
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      contacts?: Array<{ wa_id?: string }>;
      error?: { message?: string; code?: number; type?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        error:
          json.error?.message ??
          `HTTP ${res.status}${json.error?.code ? ` (${json.error.code})` : ''}`,
        status: res.status,
      };
    }
    const messageId = json.messages?.[0]?.id;
    const waId = json.contacts?.[0]?.wa_id;
    if (!messageId) {
      return { ok: false, error: 'no message id in Meta response' };
    }
    return { ok: true, messageId, waId: waId ?? digits };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
