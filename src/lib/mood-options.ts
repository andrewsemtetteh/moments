import { MOOD_EMOJI } from '@/constants/design-system';

export const ALL_MOOD_KEYS = Object.keys(MOOD_EMOJI);

/** Default quick moods when there is no history yet */
export const PRIMARY_MOOD_KEYS = ['happy', 'excited', 'calm', 'stressed', 'lonely'] as const;

export const MAX_QUICK_MOODS = 4;

export function getQuickMoods(frequentMoods: string[], currentMood?: string): string[] {
  const result: string[] = [];

  const push = (mood: string) => {
    if (result.length >= MAX_QUICK_MOODS) return;
    if (!ALL_MOOD_KEYS.includes(mood) || result.includes(mood)) return;
    result.push(mood);
  };

  if (currentMood) push(currentMood);

  for (const mood of frequentMoods) push(mood);

  for (const mood of PRIMARY_MOOD_KEYS) push(mood);

  for (const mood of ALL_MOOD_KEYS) push(mood);

  return result;
}

/** Moods for the More sheet — everything not already in the quick row */
export function getModalMoods(quickMoods: string[]): string[] {
  const quick = new Set(quickMoods);
  return ALL_MOOD_KEYS.filter((m) => !quick.has(m));
}

export function shouldShowMoodExpand(quickMoods: string[]): boolean {
  return getModalMoods(quickMoods).length > 0;
}

/** Stable defaults for the quick row (loading + empty history). */
export function getDefaultQuickMoods(): string[] {
  return PRIMARY_MOOD_KEYS.slice(0, MAX_QUICK_MOODS);
}
