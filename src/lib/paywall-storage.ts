import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISSED_AT_KEY = 'moments_paywall_dismissed_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export async function shouldShowEntryPaywall(): Promise<boolean> {
  const dismissedAt = await AsyncStorage.getItem(DISMISSED_AT_KEY);
  if (!dismissedAt) return true;
  const elapsed = Date.now() - Number(dismissedAt);
  return Number.isFinite(elapsed) && elapsed >= COOLDOWN_MS;
}

export async function markPaywallDismissed(): Promise<void> {
  await AsyncStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
}
