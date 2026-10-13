import { Linking, Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { create } from 'zustand';

import type { SubscriptionPlanId } from '@/constants/subscription';

/**
 * Moments Plus billing through RevenueCat.
 *
 * - One entitlement, `moments_unlimited`, attached to the weekly / yearly / monthly products
 *   (product ids `weekly`, `yearly`, `monthly`) in the current offering.
 * - The app user id is the Clerk user id, so the RevenueCat webhook can find the couple and
 *   unlock both partners (server/src/billing.ts).
 * - Paywall: our own native screen by default (PaywallScreen); set EXPO_PUBLIC_PAYWALL=revenuecat to
 *   show the paywall designed in the RevenueCat dashboard instead (falls back to ours if none).
 * - Customer Center (manage, cancel, refunds) for subscribers.
 * - In Expo Go the SDK runs in Preview API mode (no real purchases); use a dev build to buy.
 */

export const PLUS_ENTITLEMENT = 'moments_unlimited';

const API_KEY =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
    : Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
      : undefined;

/** True once RevenueCat keys are set for this platform; until then the paywall can't sell. */
export const BILLING_AVAILABLE = !!API_KEY;

/** Which paywall to show: our native one (default) or the one designed in RevenueCat. */
export const PAYWALL_SOURCE: 'native' | 'revenuecat' =
  process.env.EXPO_PUBLIC_PAYWALL === 'revenuecat' ? 'revenuecat' : 'native';

/** Each plan by its standard package type, or by its product id (`weekly`, `yearly`, `monthly`). */
const PACKAGE_FOR_PLAN: Record<SubscriptionPlanId, { type: string; productId: string }> = {
  weekly: { type: 'WEEKLY', productId: 'weekly' },
  yearly: { type: 'ANNUAL', productId: 'yearly' },
  monthly: { type: 'MONTHLY', productId: 'monthly' },
};

type Entitlement = { active: boolean; trial: boolean; expiresAt: string | null; willRenew: boolean };

type PurchasesState = {
  /** This phone's own entitlement, live from RevenueCat (unlocks the buyer before the webhook lands). */
  entitlement: Entitlement;
  /** Store prices for each plan, already formatted in the local currency. */
  prices: Partial<Record<SubscriptionPlanId, string>>;
  /** What a week costs on each plan, in the local currency. */
  perWeek: Partial<Record<SubscriptionPlanId, string>>;
  /** Whether this account can still get the free trial (one per subscription group). */
  trialEligible: boolean;
  /** The one time win back offer (yearly, discounted first year) if a `winback` offering exists in RevenueCat. */
  winbackPrice: string | null;
  /** Store page for managing the subscription (fallback when Customer Center isn't available). */
  managementURL: string | null;
};

const NO_ENTITLEMENT: Entitlement = { active: false, trial: false, expiresAt: null, willRenew: false };

export const usePurchasesStore = create<PurchasesState>(() => ({
  entitlement: NO_ENTITLEMENT,
  prices: {},
  perWeek: {},
  trialEligible: true,
  winbackPrice: null,
  managementURL: null,
}));

function applyCustomerInfo(info: CustomerInfo) {
  const plus = info.entitlements.active[PLUS_ENTITLEMENT];
  usePurchasesStore.setState({
    entitlement: plus
      ? {
          active: true,
          trial: plus.periodType?.toUpperCase() === 'TRIAL',
          expiresAt: plus.expirationDate ?? null,
          willRenew: plus.willRenew,
        }
      : NO_ENTITLEMENT,
    // Anyone who has ever had the entitlement has used their intro offer.
    trialEligible: !info.entitlements.all[PLUS_ENTITLEMENT],
    managementURL: info.managementURL ?? null,
  });
}

let configured = false;
let currentUserId: string | null = null;

/** Configure once and identify the signed in user. Safe to call on every sign in. */
export async function initPurchases(userId: string | null | undefined) {
  if (!BILLING_AVAILABLE || Platform.OS === 'web') return;
  try {
    if (!configured) {
      void Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.WARN);
      // Identify up front with the Clerk id (no anonymous user to merge later).
      Purchases.configure({ apiKey: API_KEY!, appUserID: userId ?? undefined });
      Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
      configured = true;
      currentUserId = userId ?? null;
    } else if (userId && userId !== currentUserId) {
      const { customerInfo } = await Purchases.logIn(userId);
      applyCustomerInfo(customerInfo);
      currentUserId = userId;
    }
    applyCustomerInfo(await Purchases.getCustomerInfo());
    void loadPrices();
  } catch (e) {
    console.warn('[purchases] init failed', e);
  }
}

/** Sign out: back to an anonymous RevenueCat user so the next account doesn't inherit Plus. */
export async function resetPurchases() {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous.
  }
  currentUserId = null;
  usePurchasesStore.setState({ entitlement: NO_ENTITLEMENT, managementURL: null });
}

/** Fresh customer info (RevenueCat caches it; this also refreshes the store). Null if unavailable. */
export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    const info = await Purchases.getCustomerInfo();
    applyCustomerInfo(info);
    return info;
  } catch (e) {
    console.warn('[purchases] customer info failed', e);
    return null;
  }
}

/** True when this account has `moments_unlimited` right now. */
export async function hasMomentsUnlimited(): Promise<boolean> {
  const info = await getCustomerInfoSafe();
  return !!info?.entitlements.active[PLUS_ENTITLEMENT];
}

/** The offering to sell from: the current one, or a named one (`winback`). */
async function currentOffering(offeringId?: string): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  if (offeringId) return offerings.all[offeringId] ?? null;
  return offerings.current ?? null;
}

function packageFor(offering: PurchasesOffering | null, plan: SubscriptionPlanId): PurchasesPackage | null {
  const { type, productId } = PACKAGE_FOR_PLAN[plan];
  const packages = offering?.availablePackages ?? [];
  return (
    packages.find((p) => p.packageType === type) ??
    packages.find((p) => p.product.identifier === productId || p.product.identifier.startsWith(`${productId}:`)) ??
    null
  );
}

/** Local store prices for the paywall (falls back to the USD constants until they load). */
export async function loadPrices() {
  if (!configured) return;
  try {
    const offering = await currentOffering();
    const prices: PurchasesState['prices'] = {};
    const perWeek: PurchasesState['perWeek'] = {};
    for (const plan of Object.keys(PACKAGE_FOR_PLAN) as SubscriptionPlanId[]) {
      const pkg = packageFor(offering, plan);
      if (!pkg) continue;
      prices[plan] = pkg.product.priceString;
      if (pkg.product.pricePerWeekString) perWeek[plan] = pkg.product.pricePerWeekString;
    }
    const winback = packageFor(await currentOffering(WINBACK_OFFERING), 'yearly');
    usePurchasesStore.setState({ prices, perWeek, winbackPrice: winback?.product.priceString ?? null });
  } catch (e) {
    console.warn('[purchases] prices failed', e);
  }
}

/** RevenueCat offering holding the discounted first year (create it in the dashboard to switch the offer on). */
export const WINBACK_OFFERING = 'winback';

export type PurchaseResult = 'purchased' | 'cancelled' | 'pending' | 'unavailable' | 'failed';

/** A short, human message for RevenueCat's purchase errors. */
function purchaseErrorMessage(e: unknown): { result: PurchaseResult; message?: string } {
  const err = e as { userCancelled?: boolean; code?: string; message?: string };
  if (err.userCancelled) return { result: 'cancelled' };
  const C = Purchases.PURCHASES_ERROR_CODE;
  switch (err.code) {
    case C.PURCHASE_CANCELLED_ERROR:
      return { result: 'cancelled' };
    case C.PAYMENT_PENDING_ERROR:
      return { result: 'pending', message: 'Your payment is pending. Plus unlocks as soon as it’s approved.' };
    case C.NETWORK_ERROR:
    case C.OFFLINE_CONNECTION_ERROR:
      return { result: 'failed', message: 'You’re offline. Check your connection and try again.' };
    case C.PURCHASE_NOT_ALLOWED_ERROR:
      return { result: 'failed', message: 'Purchases aren’t allowed on this device (check Screen Time or parental controls).' };
    case C.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
      return { result: 'unavailable', message: 'This plan isn’t available in your country yet.' };
    case C.PRODUCT_ALREADY_PURCHASED_ERROR:
      return { result: 'failed', message: 'You already have this plan. Try Restore purchase.' };
    case C.STORE_PROBLEM_ERROR:
      return { result: 'failed', message: 'The store is having trouble right now. Nothing was charged; please try again.' };
    default:
      return { result: 'failed', message: err.message };
  }
}

/** Buy a plan. The trial (where the plan has one) is applied by the store automatically. */
export async function purchasePlan(
  plan: SubscriptionPlanId,
  offeringId?: string,
): Promise<{ result: PurchaseResult; message?: string }> {
  if (!configured) return { result: 'unavailable' };
  try {
    const pkg = packageFor(await currentOffering(offeringId), plan);
    if (!pkg) return { result: 'unavailable', message: 'This plan isn’t available right now.' };
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(customerInfo);
    return customerInfo.entitlements.active[PLUS_ENTITLEMENT]
      ? { result: 'purchased' }
      : { result: 'failed', message: 'The purchase finished but Plus didn’t unlock. Try Restore purchase.' };
  } catch (e) {
    return purchaseErrorMessage(e);
  }
}

/** Restore a previous purchase (new phone, reinstall). True when Plus is active afterwards. */
export async function restorePlus(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.restorePurchases();
  applyCustomerInfo(info);
  return !!info.entitlements.active[PLUS_ENTITLEMENT];
}

// ---------------------------------------------------------------------------
// RevenueCat UI: the dashboard paywall and Customer Center (react-native-purchases-ui).
// Loaded lazily so the app still starts where its native module isn't available.
// ---------------------------------------------------------------------------

export type RevenueCatPaywallOutcome = 'purchased' | 'closed' | 'unavailable';

/**
 * Shows the paywall designed in the RevenueCat dashboard for the current (or a named) offering.
 * 'unavailable' when no paywall is configured or the UI can't load: the caller shows ours instead.
 */
export async function presentRevenueCatPaywall(offeringId?: string): Promise<RevenueCatPaywallOutcome> {
  if (!configured) return 'unavailable';
  try {
    const { default: RevenueCatUI, PAYWALL_RESULT } = await import('react-native-purchases-ui');
    const offering = offeringId ? await currentOffering(offeringId) : null;
    const result = await RevenueCatUI.presentPaywall({ displayCloseButton: true, ...(offering ? { offering } : {}) });
    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        await getCustomerInfoSafe();
        return 'purchased';
      case PAYWALL_RESULT.CANCELLED:
        return 'closed';
      case PAYWALL_RESULT.NOT_PRESENTED:
      case PAYWALL_RESULT.ERROR:
      default:
        return 'unavailable';
    }
  } catch (e) {
    console.warn('[purchases] RevenueCat paywall unavailable', e);
    return 'unavailable';
  }
}

/**
 * Manage the subscription: RevenueCat's Customer Center (plan, cancel, refund request, restore),
 * or the store's own page when it can't open.
 */
export async function openSubscriptionManagement(): Promise<void> {
  try {
    if (configured) {
      const { default: RevenueCatUI } = await import('react-native-purchases-ui');
      await RevenueCatUI.presentCustomerCenter();
      await getCustomerInfoSafe();
      return;
    }
  } catch (e) {
    console.warn('[purchases] Customer Center unavailable, opening the store page', e);
  }
  const url =
    usePurchasesStore.getState().managementURL ??
    (Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions');
  await Linking.openURL(url);
}
