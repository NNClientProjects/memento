// AiSensy WhatsApp Business API client.
// Docs: https://www.aisensy.com/api-documentation
// Templates must be approved by Meta via AiSensy dashboard before they can be sent.

const AISENSY_API_BASE = 'https://backend.aisensy.com';

export type AisensySendParams = {
  templateName: string;
  to: string;
  parameters: string[];
  campaignName?: string;
  userName?: string;
};

export type AisensySendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

export async function sendTemplateMessage(
  params: AisensySendParams
): Promise<AisensySendResult> {
  const apiKey = process.env.AISENSY_API_KEY;
  if (!apiKey) return { ok: false, error: 'AISENSY_API_KEY not configured' };

  try {
    const res = await fetch(`${AISENSY_API_BASE}/campaign/t1/api/v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        campaignName: params.campaignName ?? params.templateName,
        destination: params.to,
        userName: params.userName ?? 'event-mgmt',
        templateParams: params.parameters,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      messageId?: string;
      message?: string;
    };
    if (!res.ok) return { ok: false, error: data.message ?? `HTTP ${res.status}` };
    return { ok: true, messageId: data.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
