import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Together milestones: the days in a row you BOTH checked in. Rarer than your own
 * streak's milestones, and celebrated for both of you with the sticker heart.
 */
export const TOGETHER_MILESTONE_DAYS = [7, 30, 100, 365] as const;

export function isTogetherMilestone(days: number): boolean {
  if ((TOGETHER_MILESTONE_DAYS as readonly number[]).includes(days)) return true;
  // Every year after the first.
  return days > 365 && days % 365 === 0;
}

/** The line under the big number (the number itself is already shown). */
export function togetherMilestoneHeadline(days: number): string {
  if (days === 7) return 'days in a row, together';
  if (days === 30) return 'days together, a whole month';
  if (days === 100) return 'days together, a hundred';
  if (days === 365) return 'days together, a whole year';
  if (days % 365 === 0) return `days together, ${days / 365} years`;
  return 'days in a row, together';
}

const key = (relationshipId: string) => `together_milestone_seen:${relationshipId}`;

export async function hasSeenTogetherMilestone(relationshipId: string, days: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(key(relationshipId));
    const seen = raw ? (JSON.parse(raw) as number[]) : [];
    return Array.isArray(seen) && seen.includes(days);
  } catch {
    return false;
  }
}

export async function markTogetherMilestoneSeen(relationshipId: string, days: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(key(relationshipId));
    const seen = raw ? (JSON.parse(raw) as number[]) : [];
    if (Array.isArray(seen) && seen.includes(days)) return;
    await AsyncStorage.setItem(key(relationshipId), JSON.stringify([...(Array.isArray(seen) ? seen : []), days]));
  } catch {
    // Worst case it shows once more.
  }
}
