import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'streak_milestone_seen';

function storageKey(relationshipId: string): string {
  return `${KEY_PREFIX}:${relationshipId}`;
}

export async function getSeenStreakMilestones(relationshipId: string): Promise<number[]> {
  const raw = await AsyncStorage.getItem(storageKey(relationshipId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === 'number' && Number.isInteger(n));
  } catch {
    return [];
  }
}

export async function hasSeenStreakMilestone(
  relationshipId: string,
  days: number,
): Promise<boolean> {
  const seen = await getSeenStreakMilestones(relationshipId);
  return seen.includes(days);
}

export async function markStreakMilestoneSeen(
  relationshipId: string,
  days: number,
): Promise<void> {
  const seen = await getSeenStreakMilestones(relationshipId);
  if (seen.includes(days)) return;
  await AsyncStorage.setItem(storageKey(relationshipId), JSON.stringify([...seen, days]));
}
