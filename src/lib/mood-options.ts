import { MOOD_EMOJI } from '@/constants/design-system';

export const ALL_MOOD_KEYS = Object.keys(MOOD_EMOJI);

/** Original default moods shown when there is no history yet */
export const PRIMARY_MOOD_KEYS = ['happy', 'excited', 'calm', 'stressed', 'lonely'] as const;

export const MAX_QUICK_MOODS = 4;

export function getQuickMoods(frequentMoods: string[], currentMood?: string): string[] {
  if (frequentMoods.length === 0) {
    return [...PRIMARY_MOOD_KEYS];
  }

  const ranked = frequentMoods.filter((m) => ALL_MOOD_KEYS.includes(m)).slice(0, MAX_QUICK_MOODS);

  if (currentMood && ALL_MOOD_KEYS.includes(currentMood) && !ranked.includes(currentMood)) {
    return [currentMood, ...ranked].slice(0, MAX_QUICK_MOODS);
  }

  return ranked.length > 0 ? ranked : [...PRIMARY_MOOD_KEYS];
}

/** Moods for the More sheet — everything not already in the quick row */
export function getModalMoods(quickMoods: string[]): string[] {
  const quick = new Set(quickMoods);
  return ALL_MOOD_KEYS.filter((m) => !quick.has(m));
}

export function shouldShowMoodExpand(quickMoods: string[]): boolean {
  return getModalMoods(quickMoods).length > 0;
}
