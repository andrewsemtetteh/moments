import type { IconName } from '@/components/ui/Icon';

/**
 * Albums and places carry a little mark. They used to be emoji; they're icons
 * now. The value is stored in the old `emoji` field, so saved albums and named
 * places from before still show the matching icon.
 */
export const ALBUM_ICONS: readonly IconName[] = [
  'albums',
  'heart',
  'airplane',
  'cafe',
  'sunny',
  'balloon',
  'home',
  'camera',
  'gift',
  'star',
];

export const PLACE_ICONS: readonly IconName[] = [
  'pin',
  'cafe',
  'home',
  'walk',
  'compass',
  'globe',
  'airplane',
  'heart',
  'star',
  'moon',
];

/** The emoji each one replaced, so older saved marks keep a sensible icon. */
const LEGACY: Record<string, IconName> = {
  '💞': 'heart',
  '✈️': 'airplane',
  '🍝': 'cafe',
  '🌅': 'sunny',
  '🎉': 'balloon',
  '🏡': 'home',
  '📸': 'camera',
  '🎄': 'gift',
  '🌸': 'star',
  '🐾': 'heart',
  '📍': 'pin',
  '☕': 'cafe',
  '🌊': 'globe',
  '🏞️': 'compass',
  '🎡': 'star',
  '🌃': 'moon',
};

const KNOWN = new Set<string>([...ALBUM_ICONS, ...PLACE_ICONS]);

/** The icon to draw for a stored mark (icon name or an old emoji). */
export function markIcon(value: string | null | undefined, fallback: IconName): IconName {
  if (!value) return fallback;
  if (KNOWN.has(value)) return value as IconName;
  return LEGACY[value] ?? fallback;
}
