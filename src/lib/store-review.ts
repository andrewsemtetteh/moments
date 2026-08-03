import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const FIRST_OPEN_KEY = 'moments_store_review_first_open_at';
const LAST_PROMPT_KEY = 'moments_store_review_last_prompt_at';
const REVIEWED_KEY = 'moments_store_review_completed';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/** Record first launch so the 3-day timer can start. Safe to call often. */
export async function ensureStoreReviewFirstOpen(): Promise<void> {
  const existing = await AsyncStorage.getItem(FIRST_OPEN_KEY);
  if (existing) return;
  await AsyncStorage.setItem(FIRST_OPEN_KEY, String(Date.now()));
}

async function isMarkedReviewed(): Promise<boolean> {
  return (await AsyncStorage.getItem(REVIEWED_KEY)) === '1';
}

/** Stop auto prompts (used after an intentional Settings rate action). */
export async function markStoreReviewCompleted(): Promise<void> {
  await AsyncStorage.setItem(REVIEWED_KEY, '1');
}

async function presentNativeReview(): Promise<boolean> {
  if (!(await StoreReview.isAvailableAsync())) return false;
  await StoreReview.requestReview();
  return true;
}

/**
 * Auto prompt: after ~3 days of use, then again every 3 days until the user
 * rates from Settings. The OS may still hide the sheet (limits / already rated).
 */
export async function maybeAutoPromptStoreReview(): Promise<void> {
  await ensureStoreReviewFirstOpen();
  if (await isMarkedReviewed()) return;

  const firstOpenRaw = await AsyncStorage.getItem(FIRST_OPEN_KEY);
  const firstOpen = Number(firstOpenRaw);
  if (!Number.isFinite(firstOpen)) return;

  const now = Date.now();
  if (now - firstOpen < THREE_DAYS_MS) return;

  const lastPromptRaw = await AsyncStorage.getItem(LAST_PROMPT_KEY);
  if (lastPromptRaw) {
    const lastPrompt = Number(lastPromptRaw);
    if (Number.isFinite(lastPrompt) && now - lastPrompt < THREE_DAYS_MS) return;
  }

  const shown = await presentNativeReview();
  if (shown) {
    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(now));
  }
}

/** Settings: always try the native sheet, then stop auto prompts. */
export async function requestStoreReviewFromSettings(): Promise<void> {
  await ensureStoreReviewFirstOpen();
  try {
    await presentNativeReview();
  } finally {
    // Native APIs never confirm a review was submitted; treat Settings as intentional.
    await markStoreReviewCompleted();
    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(Date.now()));
  }
}
