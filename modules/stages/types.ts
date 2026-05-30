export type Stage = {
  id: string;
  event_id: string;
  slug: string;
  name: string;
  description: string | null;
  ordinal: number;
  color: string;
  is_initial: boolean;
  is_terminal: boolean;
  created_at: string;
  updated_at: string;
};

// Colors organisers can pick for a stage badge. Keep the list small so the UI
// stays consistent. Each entry maps to Tailwind utility classes in
// components/stage-badge.tsx.
export const STAGE_COLORS = [
  'zinc',
  'amber',
  'yellow',
  'red',
  'rose',
  'orange',
  'blue',
  'indigo',
  'green',
  'emerald',
  'purple',
  'pink',
] as const;

export type StageColor = (typeof STAGE_COLORS)[number];

export function isStageColor(s: string): s is StageColor {
  return (STAGE_COLORS as readonly string[]).includes(s);
}
