import { getSupabaseAdmin } from './supabase';

// Phase 1 has one event; we resolve by slug from env (default 'reunion-2026').
// Phase 2+ will replace this with a per-request event picker.

const DEFAULT_EVENT_SLUG = 'reunion-2026';

let cached: { slug: string; id: string; name: string } | null = null;

export function currentEventSlug(): string {
  return process.env.CURRENT_EVENT_SLUG ?? DEFAULT_EVENT_SLUG;
}

export async function getCurrentEvent(): Promise<{
  slug: string;
  id: string;
  name: string;
}> {
  const slug = currentEventSlug();
  if (cached && cached.slug === slug) return cached;

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('events')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`event '${slug}' not found — run seed migration`);

  const row = data as { id: string; name: string };
  cached = { slug, id: row.id, name: row.name };
  return cached;
}

export async function getCurrentEventId(): Promise<string> {
  return (await getCurrentEvent()).id;
}

export async function getCurrentEventName(): Promise<string> {
  return (await getCurrentEvent()).name;
}
