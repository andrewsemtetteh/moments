import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';
import { create } from 'zustand';

import type { SubscriptionPlanId } from '@/constants/subscription';

/**
 * Moments Plus billing through RevenueCat.
 *
 * - One entitlement, `plus`, on the weekly / yearly / monthly packages of the current offering.
 * - The app user id is the Clerk user id, so the RevenueCat webhook can find the couple and
 *   unlock both partners (server/src/billing.ts).
 * - In Expo Go the SDK runs in its Preview API mode (no real purchases); a dev build is needed
 *   to buy for real.
 */

export const PLUS_ENTITLEMENT = 'plus';

const API_KEY =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
    : Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
      : undefined;

/** True once RevenueCat keys are set for this platform; until then the paywall can't sell. */
export const BILLING_AVAILABLE = !!API_KEY;

const PACKAGE_FOR_PLAN: Record<SubscriptionPlanId, string> = {
  weekly: 'WEEKLY',
  yearly: 'ANNUAL',
  monthly: 'MONTHLY',
};

type Entitlement = { active: boolean; trial: boolean; expiresAt: string | null };

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
};

export const usePurchasesStore = create<PurchasesState>(() => ({
  entitlement: { active: false, trial: false, expiresAt: null },
  prices: {},
  perWeek: {},
  trialEligible: true,
  winbackPrice: null,
}));

function applyCustomerInfo(info: CustomerInfo) {
  const plus = info.entitlements.active[PLUS_ENTITLEMENT];
  usePurchasesStore.setState({
    entitlement: plus
      ? { active: true, trial: plus.periodType?.toUpperCase() === 'TRIAL', expiresAt: plus.expirationDate ?? null }
      : { active: false, trial: false, expiresAt: null },
    // Anyone who has ever had an entitlement has used their intro offer.
    trialEligible: Object.keys(info.entitlements.all).length === 0,
  });
}

let configured = false;
let currentUserId: string | null = null;

/** Configure once and identify the signed in user. Safe to call on every sign in. */
export async function initPurchases(userId: string | null | undefined) {
  if (!BILLING_AVAILABLE || Platform.OS === 'web') return;
  try {
    if (!configured) {
      Purchases.configure({ apiKey: API_KEY!, appUserID: userId ?? undefined });
      Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
      configured = true;
      currentUserId = userId ?? null;
    } else if (userId && userId !== currentUserId) {
      await Purchases.logIn(userId);
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
  usePurchasesStore.setState({ entitlement: { active: false, trial: false, expiresAt: null } });
}

/** The offering to sell from: the current one, or a named one (`winback`). */
async function currentOffering(offeringId?: string): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  if (offeringId) return offerings.all[offeringId] ?? null;
  return offerings.current ?? null;
}

function packageFor(offering: PurchasesOffering | null, plan: SubscriptionPlanId): PurchasesPackage | null {
  return offering?.availablePackages.find((p) => p.packageType === PACKAGE_FOR_PLAN[plan]) ?? null;
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

export type PurchaseResult = 'purchased' | 'cancelled' | 'unavailable' | 'failed';

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
    return { result: customerInfo.entitlements.active[PLUS_ENTITLEMENT] ? 'purchased' : 'failed' };
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return { result: 'cancelled' };
    return { result: 'failed', message: e instanceof Error ? e.message : undefined };
  }
}

/** Restore a previous purchase (new phone, reinstall). True when Plus is active afterwards. */
export async function restorePlus(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.restorePurchases();
  applyCustomerInfo(info);
  return !!info.entitlements.active[PLUS_ENTITLEMENT];
}
