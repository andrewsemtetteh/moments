import AsyncStorage from '@react-native-async-storage/async-storage';

import { localCalendarDate } from '@/lib/db-time';
import type { DailyChallenge } from '@/types/database';

const KEY_PREFIX = 'daily_challenge_cache';

function storageKey(relationshipId: string, challengeDate: string) {
  return `${KEY_PREFIX}:${relationshipId}:${challengeDate}`;
}

export async function getCachedDailyChallenge(
  relationshipId: string,
  challengeDate = localCalendarDate(),
): Promise<DailyChallenge | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(relationshipId, challengeDate));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyChallenge;
    if (!parsed?.id || parsed.challenge_date !== challengeDate) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedDailyChallenge(challenge: DailyChallenge): Promise<void> {
  if (!challenge.relationship_id || !challenge.challenge_date) return;
  await AsyncStorage.setItem(
    storageKey(challenge.relationship_id, challenge.challenge_date),
    JSON.stringify(challenge),
  );
}

export async function clearCachedDailyChallenge(
  relationshipId: string,
  challengeDate = localCalendarDate(),
): Promise<void> {
  await AsyncStorage.removeItem(storageKey(relationshipId, challengeDate));
}
