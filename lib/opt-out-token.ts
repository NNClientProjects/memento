import { createHmac, timingSafeEqual } from 'node:crypto';

// Unsubscribe links are user-facing — only the channels a participant actually
// receives messages on (email + whatsapp). 'phone' and 'in_person' are organiser
// tracking values, not channels to unsubscribe from.
export type UnsubscribableChannel = 'email' | 'whatsapp';

// Tokens are deterministic per (participantId, channel): base64url("pid|channel|sig").
// Stable signing means the same link survives across sends; convenient for organisers
// re-using the same email body. Phase 2 only handles email + whatsapp.

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function b64urlEncode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}

function b64urlDecode(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

export function makeOptOutToken(
  participantId: string,
  channel: UnsubscribableChannel
): string {
  const secret = process.env.OPT_OUT_SECRET;
  if (!secret) throw new Error('OPT_OUT_SECRET is not configured');
  const payload = `${participantId}|${channel}`;
  const sig = sign(payload, secret);
  return `${b64urlEncode(payload)}.${sig}`;
}

export type ParsedOptOutToken = {
  participantId: string;
  channel: UnsubscribableChannel;
};

export function verifyOptOutToken(token: string): ParsedOptOutToken | null {
  const secret = process.env.OPT_OUT_SECRET;
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;

  let payload: string;
  try {
    payload = b64urlDecode(encoded);
  } catch {
    return null;
  }

  const expected = sign(payload, secret);
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  const segs = payload.split('|');
  if (segs.length !== 2) return null;
  const [participantId, channelRaw] = segs;
  if (!participantId) return null;
  if (channelRaw !== 'email' && channelRaw !== 'whatsapp') return null;
  return { participantId, channel: channelRaw };
}

export function optOutLink(
  participantId: string,
  channel: UnsubscribableChannel
): string {
  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/u/${makeOptOutToken(participantId, channel)}`;
}
