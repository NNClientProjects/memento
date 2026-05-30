// Client for the WhatsApp router backend that owns the Meta webhook URL for the
// shared business number. We POST /contacts/claim to declare ownership of a
// participant's phone, so the router doesn't auto-reply when they reply to us.
//
// See docs/whatsapp-router-spec.md.

import { hasWhatsAppRouter } from '@/lib/env';

const OWNER_TAG = 'reunion-2026';

export type ClaimRequest = {
  phone: string;
  metadata?: {
    participant_id?: string;
    full_name?: string;
    event_name?: string;
    event_slug?: string;
  };
};

export type ClaimResponse =
  | {
      ok: true;
      owner: string;
      previous_owner: string | null;
    }
  | { ok: false; error: string; status?: number };

export type ClaimSkip = { ok: false; skipped: true; reason: 'router_not_configured' };

export async function claimContact(
  req: ClaimRequest
): Promise<ClaimResponse | ClaimSkip> {
  if (!hasWhatsAppRouter()) {
    return { ok: false, skipped: true, reason: 'router_not_configured' };
  }
  const path =
    process.env.ROUTER_CLAIM_PATH ?? '/v2/webhooks/contacts/claim';
  const url = `${process.env.ROUTER_BASE_URL!.replace(/\/$/, '')}${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.ROUTER_API_SECRET}`,
      },
      body: JSON.stringify({
        phone: req.phone,
        owner: OWNER_TAG,
        claimed_at: new Date().toISOString(),
        metadata: req.metadata ?? {},
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      owner?: string;
      previous_owner?: string | null;
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: json.error ?? `HTTP ${res.status}`,
        status: res.status,
      };
    }
    return {
      ok: true,
      owner: json.owner ?? OWNER_TAG,
      previous_owner: json.previous_owner ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function isClaimSkip(
  r: ClaimResponse | ClaimSkip
): r is ClaimSkip {
  return r.ok === false && (r as ClaimSkip).skipped === true;
}
