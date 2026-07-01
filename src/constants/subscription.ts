import type { IconName } from '@/components/ui/Icon';
import {
  FREE_DAILY_MOMENTS,
  FREE_TIMELINE_MOMENTS,
} from '@/constants/design-system';

/** Source of truth — see src/docs/MONETIZATION.md §4 */
export const MONTHLY_PRICE_USD = 6.99;
export const WEEKLY_PRICE_USD = 2.99;
export const YEARLY_DISCOUNT_PERCENT = 25;

export const YEARLY_COMPARE_AT_USD = roundUsd(MONTHLY_PRICE_USD * 12);
export const YEARLY_PRICE_USD = 62.99;
export const WEEKLY_COMPARE_AT_USD = roundUsd(MONTHLY_PRICE_USD / 4);

export const TRIAL_DAYS = 3;

export type SubscriptionPlanId = 'yearly' | 'monthly' | 'weekly';

function roundUsd(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** Plus-gated features — mirrors `requirePlus` call sites and free-tier limits in the app. */
export type PlusFeatureItem = {
  icon: IconName;
  title: string;
  freeLimit: string;
};

export const PLUS_FEATURE_ITEMS: PlusFeatureItem[] = [
  {
    icon: 'camera',
    title: 'Unlimited daily moments',
    freeLimit: `${FREE_DAILY_MOMENTS} per day on Free`,
  },
  {
    icon: 'list',
    title: 'Full moment timeline',
    freeLimit: `${FREE_TIMELINE_MOMENTS} recent moments on Free`,
  },
  {
    icon: 'fire',
    title: 'Streak restore',
    freeLimit: 'Plus only',
  },
];

export const TRIAL_STEPS: { day: string; title: string; body: string; icon: IconName }[] = [
  {
    day: 'Today',
    title: 'Today',
    body: 'Unlock unlimited moments, timeline, and streak restore for both of you.',
    icon: 'lock',
  },
  {
    day: 'Day 2',
    title: 'Day 2',
    body: "We'll send a reminder before your trial ends so there are no surprises.",
    icon: 'bell',
  },
  {
    day: 'Day 3',
    title: 'Day 3',
    body: 'Your subscription starts. Cancel anytime before then and you will not be charged.',
    icon: 'star',
  },
];

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  label: string;
  price: string;
  period: string;
  compareAt?: string;
  badge?: string;
  sublabel: string;
};

function buildPlanSublabel(amount: number, period: '/week' | '/month' | '/year'): string {
  return `${TRIAL_DAYS}-day free trial, then ${formatUsd(amount)}${period} per relationship`;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'weekly',
    label: 'Weekly',
    price: formatUsd(WEEKLY_PRICE_USD),
    period: '/week',
    compareAt: formatUsd(WEEKLY_COMPARE_AT_USD),
    badge: 'Flexible',
    sublabel: buildPlanSublabel(WEEKLY_PRICE_USD, '/week'),
  },
  {
    id: 'monthly',
    label: 'Monthly',
    price: formatUsd(MONTHLY_PRICE_USD),
    period: '/month',
    sublabel: buildPlanSublabel(MONTHLY_PRICE_USD, '/month'),
  },
  {
    id: 'yearly',
    label: 'Yearly',
    price: formatUsd(YEARLY_PRICE_USD),
    period: '/year',
    compareAt: formatUsd(YEARLY_COMPARE_AT_USD),
    badge: `${YEARLY_DISCOUNT_PERCENT}% off`,
    sublabel: buildPlanSublabel(YEARLY_PRICE_USD, '/year'),
  },
];

export function getTrialCtaLabel(): string {
  return `Start ${TRIAL_DAYS}-Day Free Trial`;
}

export function getTrialPriceLine(planId: SubscriptionPlanId): string {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId)!;
  return `${TRIAL_DAYS}-day free trial, then ${plan.price}${plan.period} per relationship`;
}
