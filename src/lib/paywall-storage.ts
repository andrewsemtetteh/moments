import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISSED_AT_KEY = 'moments_paywall_dismissed_at';
const FIRST_DISMISSED_AT_KEY = 'moments_paywall_first_dismissed_at';
const WINBACK_SHOWN_KEY = 'moments_paywall_winback_shown';
const PARTNER_JOINED_KEY = (relationshipId: string) => `moments_paywall_partner_joined:${relationshipId}`;

const DAY_MS = 24 * 60 * 60 * 1000;
/** The Home reminder and milestone paywalls wait this long after any close. */
const COOLDOWN_MS = 7 * DAY_MS;
/** The win back offer comes this long after the first close. */
const WINBACK_AFTER_MS = 3 * DAY_MS;

async function readTime(key: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(key);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** True when the paywall hasn't been closed in the last 7 days. */
export async function shouldShowEntryPaywall(): Promise<boolean> {
  const dismissedAt = await readTime(DISMISSED_AT_KEY);
  return dismissedAt == null || Date.now() - dismissedAt >= COOLDOWN_MS;
}

export async function markPaywallDismissed(): Promise<void> {
  const now = String(Date.now());
  await AsyncStorage.setItem(DISMISSED_AT_KEY, now);
  if (!(await AsyncStorage.getItem(FIRST_DISMISSED_AT_KEY))) await AsyncStorage.setItem(FIRST_DISMISSED_AT_KEY, now);
}

/** The one time win back offer: 3+ days after the first close, never shown before. */
export async function shouldShowWinback(): Promise<boolean> {
  if (await AsyncStorage.getItem(WINBACK_SHOWN_KEY)) return false;
  const first = await readTime(FIRST_DISMISSED_AT_KEY);
  return first != null && Date.now() - first >= WINBACK_AFTER_MS;
}

export async function markWinbackShown(): Promise<void> {
  await AsyncStorage.setItem(WINBACK_SHOWN_KEY, String(Date.now()));
}

/** "You're connected!" paywall: once per couple. */
export async function hasShownPartnerJoinedPaywall(relationshipId: string): Promise<boolean> {
  return !!(await AsyncStorage.getItem(PARTNER_JOINED_KEY(relationshipId)));
}

export async function markPartnerJoinedPaywallShown(relationshipId: string): Promise<void> {
  await AsyncStorage.setItem(PARTNER_JOINED_KEY(relationshipId), String(Date.now()));
}
