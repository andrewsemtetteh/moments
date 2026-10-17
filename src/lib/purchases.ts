import { requireOptionalNativeModule } from 'expo';
import * as Crypto from 'expo-crypto';
import { Linking, Platform } from 'react-native';
import { create } from 'zustand';

import type { SubscriptionPlanId } from '@/constants/subscription';

/**
 * Moments Plus billing through Superwall (StoreKit 2 / Google Play Billing, no RevenueCat).
 *
 * - One entitlement, `unlimited`, attached in the Superwall dashboard to the weekly / yearly /
 *   monthly products (PRODUCT_IDS below).
 * - Superwall identifies each person by a UUID derived from their Clerk id (StoreKit only accepts a
 *   UUID as appAccountToken), plus a `clerkUserId` attribute. The Superwall webhook maps either back
 *   to the person and unlocks both partners (server/src/billing.ts).
 * - Paywall: our own native screen by default (PaywallScreen); set EXPO_PUBLIC_PAYWALL=superwall to
 *   show the paywall designed in the Superwall dashboard instead (falls back to ours if none shows).
 * - Needs a development / store build: Superwall has no Expo Go or web module, so there the app
 *   runs without billing (the paywall lets people carry on with Free).
 */

export const PLUS_ENTITLEMENT = 'unlimited';

const API_KEY =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_SUPERWALL_IOS_API_KEY
    : Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_API_KEY
      : undefined;

/** Superwall's native module is in this build (not in Expo Go or on web). */
const NATIVE_AVAILABLE = Platform.OS !== 'web' && !!requireOptionalNativeModule('SuperwallExpo');

/** True once Superwall keys are set and the native module is present; until then the paywall can't sell. */
export const BILLING_AVAILABLE = !!API_KEY && NATIVE_AVAILABLE;

type SuperwallModule = typeof import('expo-superwall');

/** The SDK, loaded only where its native module exists (a static import crashes Expo Go). */
export const superwall: SuperwallModule | null = BILLING_AVAILABLE
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-superwall') as SuperwallModule)
  : null;

/** Superwall SDK keys for SuperwallProvider (only read when BILLING_AVAILABLE). */
export const SUPERWALL_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_SUPERWALL_IOS_API_KEY,
  android: process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_API_KEY,
};

/** Which paywall to show: our native one (default) or the one designed in Superwall. */
export const PAYWALL_SOURCE: 'native' | 'superwall' =
  process.env.EXPO_PUBLIC_PAYWALL === 'superwall' ? 'superwall' : 'native';

/**
 * Store product ids for each plan, as set up in Superwall. iOS: the App Store Connect product id.
 * Android: `subscriptionId:basePlanId:offer`, where `sw-auto` lets Superwall pick the best offer
 * the person is eligible for (the free trial, until they've used it).
 */
const PRODUCT_IDS: Record<SubscriptionPlanId, string> =
  Platform.OS === 'android'
    ? { weekly: 'weekly:weekly:sw-auto', yearly: 'yearly:yearly:sw-auto', monthly: 'monthly:monthly:sw-auto' }
    : { weekly: 'weekly', yearly: 'yearly', monthly: 'monthly' };

/** Plans whose introductory offer is free (mirrors `intro` in src/constants/subscription.ts). */
const FREE_TRIAL_PLANS: SubscriptionPlanId[] = ['yearly'];

/** Same store subscription (Android ids may come back with or without the base plan / offer parts). */
function sameProduct(a: string, b: string): boolean {
  return a === b || a.split(':')[0] === b.split(':')[0];
}

/**
 * The one time win back offer: a second yearly product whose introductory offer is the discounted
 * first year. Create it in the stores and add it to Superwall to switch the offer on.
 */
const WINBACK_PRODUCT_ID = 'yearly_winback';
export const WINBACK_OFFER = 'winback';

type Entitlement = { active: boolean; trial: boolean; expiresAt: string | null; willRenew: boolean };

type PurchasesState = {
  /** This phone's own entitlement, live from Superwall (unlocks the buyer before the webhook lands). */
  entitlement: Entitlement;
  /** Store prices for each plan, already formatted in the local currency. */
  prices: Partial<Record<SubscriptionPlanId, string>>;
  /** What a week costs on each plan, in the local currency. */
  perWeek: Partial<Record<SubscriptionPlanId, string>>;
  /** What a month costs on each plan, in the local currency ("$5.83" on yearly). */
  perMonth: Partial<Record<SubscriptionPlanId, string>>;
  /** Each plan's price split between the two of you ("$35.00" on yearly). */
  perPerson: Partial<Record<SubscriptionPlanId, string>>;
  /** Paid introductory prices ("$0.99" for weekly's first week), in the local currency. */
  introPrices: Partial<Record<SubscriptionPlanId, string>>;
  /** Whether this account can still get an introductory offer (one per subscription group). */
  trialEligible: boolean;
  /** The discounted first year, if the win back product exists in the store. */
  winbackPrice: string | null;
  /** Nothing, in the store's currency ("$0.00", "AED 0.00"), for "Try 7 days for $0.00". */
  zeroPrice: string | null;
  /** Product id of the active subscription (Play's manage page links straight to it). */
  activeProductId: string | null;
};

const NO_ENTITLEMENT: Entitlement = { active: false, trial: false, expiresAt: null, willRenew: false };

export const usePurchasesStore = create<PurchasesState>(() => ({
  entitlement: NO_ENTITLEMENT,
  prices: {},
  perWeek: {},
  perMonth: {},
  perPerson: {},
  introPrices: {},
  trialEligible: true,
  winbackPrice: null,
  zeroPrice: null,
  activeProductId: null,
}));

type SuperwallState = ReturnType<SuperwallModule['useSuperwallStore']['getState']>;

function sdk(): SuperwallState {
  return superwall!.useSuperwallStore.getState();
}

/** Mirrors Superwall's subscription status and purchase history into our store. */
function applySuperwallState({ subscriptionStatus, customerInfo }: SuperwallState) {
  const active =
    subscriptionStatus.status === 'ACTIVE' && subscriptionStatus.entitlements.some((e) => e.id === PLUS_ENTITLEMENT);
  const subs = customerInfo?.subscriptions ?? [];
  const current = subs.filter((s) => s.isActive).sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))[0];
  usePurchasesStore.setState({
    entitlement: active
      ? {
          active: true,
          // Only a free intro is a trial: weekly's paid first week is a normal, paid period.
          trial:
            current?.offerType === 'trial' &&
            FREE_TRIAL_PLANS.some((plan) => sameProduct(current.productId, PRODUCT_IDS[plan])),
          expiresAt: current?.expirationDate ?? null,
          willRenew: current?.willRenew ?? true,
        }
      : NO_ENTITLEMENT,
    // Anyone who has ever subscribed has used their intro offer. Unknown history keeps the trial on.
    ...(customerInfo ? { trialEligible: subs.length === 0 } : {}),
    activeProductId: current?.productId ?? null,
  });
}

/** The person's Superwall id. Must match `billingUserId` in server/src/billing.ts exactly. */
export async function billingUserId(clerkUserId: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, `moments-billing:${clerkUserId}`);
  const b = hex.slice(0, 32).match(/../g)!.map((h) => parseInt(h, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const out = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20)}`;
}

let listening = false;
let currentUserId: string | null = null;
/** The user to identify; retried once Superwall finishes configuring if the first try timed out. */
let wantedUserId: string | null = null;

/** Identify the signed in user with Superwall. Safe to call on every sign in. */
export async function initPurchases(userId: string | null | undefined) {
  if (!superwall) return;
  wantedUserId = userId ?? null;
  try {
    if (!listening) {
      superwall.useSuperwallStore.subscribe((state, prev) => {
        applySuperwallState(state);
        if (state.isConfigured && !prev.isConfigured && wantedUserId && wantedUserId !== currentUserId) {
          void initPurchases(wantedUserId);
        }
      });
      listening = true;
    }
    if (userId && userId !== currentUserId) {
      await sdk().identify(await billingUserId(userId));
      // The webhook also reads this, in case the store reports a different id.
      await sdk().setUserAttributes({ clerkUserId: userId });
      currentUserId = userId;
    }
    applySuperwallState(sdk());
    void sdk()
      .getCustomerInfo()
      .then(() => applySuperwallState(sdk()))
      .catch(() => undefined);
    void loadPrices();
  } catch (e) {
    console.warn('[purchases] init failed', e);
  }
}

/** Sign out: back to an anonymous Superwall user so the next account doesn't inherit Plus. */
export async function resetPurchases() {
  currentUserId = null;
  wantedUserId = null;
  usePurchasesStore.setState({ entitlement: NO_ENTITLEMENT, activeProductId: null, trialEligible: true });
  if (!superwall) return;
  try {
    await sdk().reset();
  } catch {
    // Already anonymous.
  }
}

/** An amount in a store's currency ("$35.00"); null if it can't be formatted. */
function formatMoney(amount: number, currency: string | null | undefined, locale: string | undefined): string | null {
  if (!currency) return null;
  try {
    return new Intl.NumberFormat(locale?.replace('_', '-'), { style: 'currency', currency }).format(amount);
  } catch {
    return null;
  }
}

/** Half of a store price, in its own currency ("$35.00"); null if it can't be formatted. */
function halfPrice(price: number, currency: string | null | undefined, locale: string | undefined): string | null {
  return price > 0 ? formatMoney(price / 2, currency, locale) : null;
}

/** Local store prices for the paywall (falls back to the USD constants until they load). */
export async function loadPrices() {
  if (!superwall) return;
  try {
    const plans = Object.keys(PRODUCT_IDS) as SubscriptionPlanId[];
    const products = await sdk().products([...plans.map((p) => PRODUCT_IDS[p]), WINBACK_PRODUCT_ID]);
    const find = (id: string) => products.find((p) => sameProduct(p.productIdentifier, id));
    const prices: PurchasesState['prices'] = {};
    const perWeek: PurchasesState['perWeek'] = {};
    const perMonth: PurchasesState['perMonth'] = {};
    const perPerson: PurchasesState['perPerson'] = {};
    const introPrices: PurchasesState['introPrices'] = {};
    for (const plan of plans) {
      const product = find(PRODUCT_IDS[plan]);
      if (!product) continue;
      prices[plan] = product.localizedPrice;
      if (product.weeklyPrice) perWeek[plan] = product.weeklyPrice;
      if (product.monthlyPrice) perMonth[plan] = product.monthlyPrice;
      const half = halfPrice(product.price, product.currencyCode, product.locale);
      if (half) perPerson[plan] = half;
      // A paid intro offer (Superwall reports intro offers as the "trial" period).
      if (product.trialPeriodPrice > 0) introPrices[plan] = product.localizedTrialPeriodPrice;
    }
    // The win back product's introductory price is the discounted first year.
    const winback = find(WINBACK_PRODUCT_ID);
    const winbackPrice = winback && winback.trialPeriodPrice > 0 ? winback.localizedTrialPeriodPrice : null;
    const any = find(PRODUCT_IDS.yearly) ?? products[0];
    const zeroPrice = any ? formatMoney(0, any.currencyCode, any.locale) : null;
    usePurchasesStore.setState({ prices, perWeek, perMonth, perPerson, introPrices, winbackPrice, zeroPrice });
  } catch (e) {
    console.warn('[purchases] prices failed', e);
  }
}

/** Resolves once Superwall reports Plus (or after `ms`): a purchase's status can land a moment later. */
async function waitForPlus(ms = 4000): Promise<boolean> {
  if (usePurchasesStore.getState().entitlement.active) return true;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(usePurchasesStore.getState().entitlement.active);
    }, ms);
    const unsubscribe = usePurchasesStore.subscribe((s) => {
      if (!s.entitlement.active) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(true);
    });
  });
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'pending' | 'unavailable' | 'failed';

/** Buy a plan. The trial (where the plan has one) is applied by the store automatically. */
export async function purchasePlan(
  plan: SubscriptionPlanId,
  offer?: typeof WINBACK_OFFER,
): Promise<{ result: PurchaseResult; message?: string }> {
  if (!superwall) return { result: 'unavailable' };
  const productId = offer === WINBACK_OFFER && plan === 'yearly' ? WINBACK_PRODUCT_ID : PRODUCT_IDS[plan];
  try {
    const outcome = await sdk().purchase(productId);
    switch (outcome.type) {
      case 'purchased':
        // Charged: unlock as soon as Superwall confirms; the webhook unlocks the couple regardless.
        await waitForPlus();
        return { result: 'purchased' };
      case 'cancelled':
        return { result: 'cancelled' };
      case 'pending':
        return { result: 'pending', message: 'Your payment is pending. Plus unlocks as soon as it’s approved.' };
      case 'failed':
      default:
        console.warn('[purchases] purchase failed', outcome);
        return {
          result: 'failed',
          message: 'The purchase didn’t go through. Nothing was charged; please try again.',
        };
    }
  } catch (e) {
    console.warn('[purchases] purchase threw', e);
    return { result: 'failed', message: 'The store is having trouble right now. Nothing was charged; please try again.' };
  }
}

/** Restore a previous purchase (new phone, reinstall). True when Plus is active afterwards. */
export async function restorePlus(): Promise<boolean> {
  if (!superwall) return false;
  const outcome = await sdk().restorePurchases();
  if (outcome.result === 'failed') throw new Error(outcome.errorMessage ?? 'Restore failed');
  await sdk()
    .getCustomerInfo()
    .then(() => applySuperwallState(sdk()))
    .catch(() => undefined);
  return waitForPlus(2500);
}

/** Manage the subscription: the store's own page (plan, cancel, refunds go through Apple / Google). */
export async function openSubscriptionManagement(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL('https://apps.apple.com/account/subscriptions');
    return;
  }
  const sku = usePurchasesStore.getState().activeProductId?.split(':')[0];
  const params = sku ? `?sku=${encodeURIComponent(sku)}&package=com.vasemti.moments` : '';
  await Linking.openURL(`https://play.google.com/store/account/subscriptions${params}`);
}
