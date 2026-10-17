import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * You stay signed in until you sign out (no "Remember me" any more). All that's kept
 * here is the last email you signed in with, to fill in the sign-in screen next time.
 */
const REMEMBERED_EMAIL_KEY = 'moments_remembered_email';
/** The old "Remember me" choice: cleared so an old opt-out can't sign anyone out. */
const LEGACY_REMEMBER_ME_KEY = 'moments_remember_me';

export async function getRememberedEmail(): Promise<string | null> {
  return AsyncStorage.getItem(REMEMBERED_EMAIL_KEY);
}

export async function setRememberedEmail(email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return;
  await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, trimmed);
}

export async function clearLegacyRememberMe(): Promise<void> {
  await AsyncStorage.removeItem(LEGACY_REMEMBER_ME_KEY).catch(() => undefined);
}
