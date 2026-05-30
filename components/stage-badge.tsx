import type { StageColor } from '@/modules/stages/types';

// Tailwind utility maps for the configurable palette. Each color gets a
// background, foreground, and an inset ring.
const COLOR_CLASSES: Record<StageColor, string> = {
  zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  amber: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
  yellow: 'bg-yellow-100 text-yellow-800 ring-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:ring-yellow-900',
  red: 'bg-red-100 text-red-800 ring-red-300 dark:bg-red-950 dark:text-red-300 dark:ring-red-900',
  rose: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900',
  orange: 'bg-orange-100 text-orange-800 ring-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-900',
  blue: 'bg-blue-100 text-blue-800 ring-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900',
  green: 'bg-green-100 text-green-800 ring-green-300 dark:bg-green-950 dark:text-green-300 dark:ring-green-900',
  emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900',
  purple: 'bg-purple-100 text-purple-800 ring-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:ring-purple-900',
  pink: 'bg-pink-100 text-pink-800 ring-pink-300 dark:bg-pink-950 dark:text-pink-300 dark:ring-pink-900',
};

function colorClass(color: string | null | undefined): string {
  if (color && color in COLOR_CLASSES)
    return COLOR_CLASSES[color as StageColor];
  return COLOR_CLASSES.zinc;
}

export function StageBadge({
  name,
  color,
  terminal,
}: {
  name: string;
  color: string | null | undefined;
  terminal?: boolean;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${colorClass(color)} ${terminal ? 'opacity-80' : ''}`}
    >
      {name}
    </span>
  );
}

// Small color-only swatch, used in dropdowns and the color picker.
export function StageColorSwatch({ color }: { color: string }) {
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ring-1 ring-inset ${colorClass(color)}`}
      aria-hidden="true"
    />
  );
}
