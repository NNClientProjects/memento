// Helpers for parsing Meta WhatsApp webhook payloads forwarded by the router.
// Pure functions — no Node-only imports.

import { normalizeToE164 } from './phone';

// Standard WhatsApp Business opt-out keywords. Match on the first word, case-insensitive.
// Phase 2: any of these in an inbound text triggers a whatsapp opt-out.
export const STOP_KEYWORDS = ['stop', 'stopall', 'unsubscribe', 'quit', 'cancel', 'end'];

export function isStopMessage(text: string | null | undefined): boolean {
  if (!text) return false;
  const firstWord = text.trim().toLowerCase().split(/\s+/)[0];
  return STOP_KEYWORDS.includes(firstWord);
}

export type ExtractedMessage = {
  senderPhoneE164: string | null;
  text: string | null;
  messageId: string | null;
  timestamp: string | null;
  messageType: string;
  raw: unknown;
};

// Meta webhook payloads have the shape:
// {
//   object: 'whatsapp_business_account',
//   entry: [{ id, changes: [{ value: { messages: [...], contacts: [...], metadata: {...} }, field }] }]
// }
// Different events nest under value: messages (incoming), statuses (delivery), etc.
// We only handle text messages for Phase 2.
export function extractMessageFromMetaPayload(
  payload: unknown
): ExtractedMessage | null {
  const entry = readPath(payload, ['entry', 0]);
  const change = readPath(entry, ['changes', 0]);
  const value = readPath(change, ['value']);
  const message = readPath(value, ['messages', 0]) as
    | Record<string, unknown>
    | undefined;
  if (!message || typeof message !== 'object') return null;

  const from = typeof message.from === 'string' ? message.from : null;
  const senderPhoneE164 = from ? normalizeToE164(from.startsWith('+') ? from : `+${from}`) : null;

  const type = typeof message.type === 'string' ? message.type : 'unknown';
  let text: string | null = null;
  if (type === 'text') {
    const textObj = message.text as { body?: string } | undefined;
    text = textObj?.body ?? null;
  } else if (type === 'button') {
    const buttonObj = message.button as { text?: string } | undefined;
    text = buttonObj?.text ?? null;
  }

  return {
    senderPhoneE164,
    text,
    messageId: typeof message.id === 'string' ? message.id : null,
    timestamp:
      typeof message.timestamp === 'string'
        ? new Date(parseInt(message.timestamp, 10) * 1000).toISOString()
        : null,
    messageType: type,
    raw: message,
  };
}

function readPath(value: unknown, path: Array<string | number>): unknown {
  let cur: unknown = value;
  for (const k of path) {
    if (cur == null) return undefined;
    if (typeof k === 'number') {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[k];
    } else {
      if (typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[k];
    }
  }
  return cur;
}

export type ForwardedInboundPayload = {
  owner?: string;
  sender_phone?: string;
  received_at?: string;
  meta_payload?: unknown;
};
