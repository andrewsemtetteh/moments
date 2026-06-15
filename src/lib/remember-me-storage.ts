import AsyncStorage from '@react-native-async-storage/async-storage';

const REMEMBER_ME_KEY = 'moments_remember_me';
const REMEMBERED_EMAIL_KEY = 'moments_remembered_email';

/** Defaults to true — keep users signed in unless they opt out. */
export async function getRememberMe(): Promise<boolean> {
  const value = await AsyncStorage.getItem(REMEMBER_ME_KEY);
  if (value === null) return true;
  return value === 'true';
}

export async function setRememberMe(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(REMEMBER_ME_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
  }
}

export async function getRememberedEmail(): Promise<string | null> {
  const rememberMe = await getRememberMe();
  if (!rememberMe) return null;
  return AsyncStorage.getItem(REMEMBERED_EMAIL_KEY);
}

export async function setRememberedEmail(email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return;
  await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, trimmed);
}
