// Client-safe: this module has no server-only imports so it can run in a "use client" file.

export const KNOWN_MERGE_FIELDS = [
  'full_name',
  'first_name',
  'email',
  'phone',
  'dorm',
  'dorm_number',
  'section',
  'family_group_id',
  'event_name',
] as const;

export type MergeFieldName = (typeof KNOWN_MERGE_FIELDS)[number];

const FIELD_PATTERN = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;

export function extractMergeFields(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(FIELD_PATTERN)) {
    found.add(m[1].toLowerCase());
  }
  return Array.from(found);
}

export type MergeContext = Record<string, string>;

export function render(text: string, ctx: MergeContext): string {
  return text.replace(
    FIELD_PATTERN,
    (_, name: string) => ctx[name.toLowerCase()] ?? ''
  );
}

export function unknownFields(used: string[]): string[] {
  const known = new Set<string>(KNOWN_MERGE_FIELDS);
  return used.filter((f) => !known.has(f));
}
