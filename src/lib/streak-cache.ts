import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StreakStatus } from '@/types/database';

const KEY_PREFIX = 'streak_status_cache';

function storageKey(relationshipId: string) {
  return `${KEY_PREFIX}:${relationshipId}`;
}

export async function getCachedStreakStatus(relationshipId: string): Promise<StreakStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(relationshipId));
    if (!raw) return null;
    return JSON.parse(raw) as StreakStatus;
  } catch {
    return null;
  }
}

export async function setCachedStreakStatus(
  relationshipId: string,
  status: StreakStatus,
): Promise<void> {
  await AsyncStorage.setItem(storageKey(relationshipId), JSON.stringify(status));
}

export async function clearCachedStreakStatus(relationshipId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(relationshipId));
}
