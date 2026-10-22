import { ANDROID_PACKAGE, APP_STORE_ID, SUPPORT_EMAIL } from '@/constants/links';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Alert, Linking, Platform } from 'react-native';

const FIRST_OPEN_KEY = 'moments_store_review_first_open_at';
const REVIEWED_KEY = 'moments_store_review_completed';

/** Record first launch. Safe to call often. */
export async function ensureStoreReviewFirstOpen(): Promise<void> {
  const existing = await AsyncStorage.getItem(FIRST_OPEN_KEY);
  if (existing) return;
  await AsyncStorage.setItem(FIRST_OPEN_KEY, String(Date.now()));
}

async function isMarkedReviewed(): Promise<boolean> {
  return (await AsyncStorage.getItem(REVIEWED_KEY)) === '1';
}

/** They went to the store to rate: never ask again. */
export async function markStoreReviewCompleted(): Promise<void> {
  await AsyncStorage.setItem(REVIEWED_KEY, '1');
}

/** "App Store" or "Google Play", for button labels. */
export const STORE_NAME = Platform.OS === 'android' ? 'Google Play' : 'App Store';

/**
 * Opens the store's own "write a review" screen. Apps can't send a rating
 * themselves; this takes people to where they rate. Unlike Apple's in-app sheet
 * (which may silently not show: it's capped at 3 a year), this always opens.
 *
 * - iPhone: the App Store's review composer, once EXPO_PUBLIC_APP_STORE_ID is set
 *   (the number in the App Store link). Before that, Apple's in-app sheet.
 * - Android: the Play Store page (the review box is on it).
 *
 * Returns true if something opened.
 */
export async function openStoreReview(): Promise<boolean> {
  const tries: string[] =
    Platform.OS === 'android'
      ? [`market://details?id=${ANDROID_PACKAGE}`, `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`]
      : APP_STORE_ID
        ? [
            `itms-apps://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`,
            `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`,
          ]
        : [];
  for (const url of tries) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Try the next form (e.g. no store app, so the web page).
    }
  }
  // iPhone before the App Store id is known: Apple's sheet, if it's allowed to show.
  if (await StoreReview.isAvailableAsync().catch(() => false)) {
    await StoreReview.requestReview().catch(() => undefined);
    return true;
  }
  Alert.alert('Thank you!', `Ratings open once Moments is on the ${STORE_NAME}.`);
  return false;
}

/**
 * The stars sheet inside Moments (Apple's / Google's own in-app review), so nobody has
 * to leave the app. The system decides whether it actually shows (Apple caps it at 3 a
 * year; it never shows in TestFlight or Expo Go), so the page keeps a store link too.
 * Returns false when this phone can't show it at all.
 */
export async function requestInAppReview(): Promise<boolean> {
  if (!(await StoreReview.isAvailableAsync().catch(() => false))) return false;
  try {
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}

/** Settings › Rate Moments: they chose to rate, so straight to the store. */
export async function rateFromSettings(): Promise<void> {
  if (await openStoreReview()) await markStoreReviewCompleted();
}

// ── The rating ask (RatingPage) ─────────────────────────────────────────────
// Shows once they've really used the app (7 different days). Closed or "maybe
// later": again in 4 days. Gave feedback: not for 30 days. Rated: never again.

const ACTIVE_DAYS_KEY = 'moments_rating_active_days';
const SNOOZE_UNTIL_KEY = 'moments_rating_snooze_until';
/** Older builds stored when it was closed; still honoured. */
const DISMISSED_AT_KEY = 'moments_rating_dismissed_at';
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_ACTIVE_DAYS = 7;
const RESHOW_AFTER_DAYS = 4;
const AFTER_FEEDBACK_DAYS = 30;
export const FEEDBACK_EMAIL = SUPPORT_EMAIL;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Count today as a day of use (call on app open). */
export async function recordActiveDay(): Promise<number> {
  const raw = await AsyncStorage.getItem(ACTIVE_DAYS_KEY);
  const days: string[] = raw ? JSON.parse(raw) : [];
  const today = todayKey();
  if (!days.includes(today)) {
    days.push(today);
    await AsyncStorage.setItem(ACTIVE_DAYS_KEY, JSON.stringify(days.slice(-60)));
  }
  return days.length;
}

export async function shouldShowRatingPage(): Promise<boolean> {
  if (await isMarkedReviewed()) return false;
  const activeDays = await recordActiveDay();
  if (activeDays < MIN_ACTIVE_DAYS) return false;
  const now = Date.now();
  const until = Number(await AsyncStorage.getItem(SNOOZE_UNTIL_KEY));
  if (Number.isFinite(until) && until > now) return false;
  const dismissed = Number(await AsyncStorage.getItem(DISMISSED_AT_KEY));
  if (Number.isFinite(dismissed) && dismissed > 0 && now - dismissed < RESHOW_AFTER_DAYS * DAY_MS) return false;
  return true;
}

async function snoozeRatingPage(days: number): Promise<void> {
  await AsyncStorage.setItem(SNOOZE_UNTIL_KEY, String(Date.now() + days * DAY_MS));
}

/** Closed, or "maybe later": ask again in a few days. */
export async function markRatingPageDismissed(): Promise<void> {
  await snoozeRatingPage(RESHOW_AFTER_DAYS);
}

/** The store's prompt was asked for: not again for two months (the stores cap it too). */
export async function markReviewPromptAsked(): Promise<void> {
  await snoozeRatingPage(REVIEW_PROMPT_EVERY_DAYS);
}
const REVIEW_PROMPT_EVERY_DAYS = 60;

/** They told us what's wrong: leave them be for a month. */
export async function markRatingFeedbackGiven(): Promise<void> {
  await snoozeRatingPage(AFTER_FEEDBACK_DAYS);
}

export async function sendFeedbackByEmail(): Promise<void> {
  await Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Moments feedback')}`).catch(
    () => undefined,
  );
}
