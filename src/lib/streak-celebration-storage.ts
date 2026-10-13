import AsyncStorage from '@react-native-async-storage/async-storage';

/** The last streak count we celebrated on this phone, per relationship. */
const key = (relationshipId: string) => `streak_celebrated:${relationshipId}`;

export async function getLastCelebratedStreak(relationshipId: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(key(relationshipId)).catch(() => null);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function setLastCelebratedStreak(relationshipId: string, count: number): Promise<void> {
  await AsyncStorage.setItem(key(relationshipId), String(count)).catch(() => undefined);
}
