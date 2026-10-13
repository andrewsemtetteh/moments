import type { IconName } from '@/components/ui/Icon';
import { FREE_DAILY_MOMENTS, FREE_TIMELINE_MOMENTS } from '@/constants/design-system';

/**
 * Moments Plus pricing: source of truth (see src/docs/MONETIZATION.md §4).
 * One subscription per couple. Store prices (local currency) replace these USD figures on the
 * paywall once RevenueCat loads; these are the fallbacks and the basis for the per week maths.
 */
export const WEEKLY_PRICE_USD = 4.99;
export const YEARLY_PRICE_USD = 69.99;
export const MONTHLY_PRICE_USD = 9.99;

/** Free trial on weekly and yearly (monthly has none). Set the same on the store products. */
export const TRIAL_DAYS = 7;
/** The day before the trial ends, when we remind them. */
export const TRIAL_REMINDER_DAY = 5;


/** True once RevenueCat keys are configured; until then the paywall lets people carry on with Free. */
export const BILLING_CONNECTED = !!(
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
);

export type SubscriptionPlanId = 'weekly' | 'yearly' | 'monthly';

const WEEKS_PER_YEAR = 52;

function roundUsd(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** What a week costs on each plan, for the per week line on every card. */
export const PER_WEEK_USD: Record<SubscriptionPlanId, number> = {
  weekly: WEEKLY_PRICE_USD,
  yearly: roundUsd(YEARLY_PRICE_USD / WEEKS_PER_YEAR),
  monthly: roundUsd((MONTHLY_PRICE_USD * 12) / WEEKS_PER_YEAR),
};

/** Yearly vs paying weekly all year (69.99 vs 259.48 → 73%). */
export const YEARLY_SAVING_PERCENT = Math.round((1 - YEARLY_PRICE_USD / (WEEKLY_PRICE_USD * WEEKS_PER_YEAR)) * 100);

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  /** Billed price (fallback; the store's local price replaces it). */
  priceUsd: number;
  /** "/week" etc, after the price. */
  per: string;
  /** "a week", "a year", "a month" for sentences. */
  perWords: string;
  trial: boolean;
  badge?: string;
};

/** In the order shown. Weekly is selected by default. */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'weekly',
    name: 'Weekly',
    priceUsd: WEEKLY_PRICE_USD,
    per: '/week',
    perWords: 'a week',
    trial: true,
    badge: `${TRIAL_DAYS} days free`,
  },
  {
    id: 'yearly',
    name: 'Yearly',
    priceUsd: YEARLY_PRICE_USD,
    per: '/year',
    perWords: 'a year',
    trial: true,
    badge: `Best value · Save ${YEARLY_SAVING_PERCENT}%`,
  },
  { id: 'monthly', name: 'Monthly', priceUsd: MONTHLY_PRICE_USD, per: '/month', perWords: 'a month', trial: false },
];

export const DEFAULT_PLAN: SubscriptionPlanId = 'weekly';

export function planById(id: SubscriptionPlanId): SubscriptionPlan {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id) ?? SUBSCRIPTION_PLANS[0];
}

/** Plus-gated features: mirrors `requirePlus` call sites and free tier limits in the app. */
export type PlusFeatureItem = {
  icon: IconName;
  title: string;
  freeLimit: string;
};

export const PLUS_FEATURE_ITEMS: PlusFeatureItem[] = [
  { icon: 'camera', title: 'Unlimited daily moments', freeLimit: `${FREE_DAILY_MOMENTS} per day on Free` },
  { icon: 'list', title: 'Full moment timeline', freeLimit: `${FREE_TIMELINE_MOMENTS} recent moments on Free` },
  { icon: 'sparkles', title: 'AI games and questions', freeLimit: 'Plus only' },
  { icon: 'fire', title: 'Streak restore', freeLimit: 'Plus only' },
];
