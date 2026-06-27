import AsyncStorage from '@react-native-async-storage/async-storage';

/** User has passed first-run welcome / auth entry; skip marketing welcome when signed out. */
const INTRO_COMPLETED_KEY = 'moments_intro_completed';

export async function markIntroCompleted() {
  await AsyncStorage.setItem(INTRO_COMPLETED_KEY, '1');
}

export async function isIntroCompleted(): Promise<boolean> {
  const value = await AsyncStorage.getItem(INTRO_COMPLETED_KEY);
  return value === '1';
}
