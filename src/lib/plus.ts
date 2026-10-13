import { Alert } from 'react-native';

import { usePurchasesStore } from '@/lib/purchases';
import { getEffectiveTier, isRelationshipTrial } from '@/lib/subscription';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';

/**
 * Plus checks for code outside React (module functions like openLiveSession, error handlers).
 * Components use `useSubscription` / `usePlusGate` instead.
 */

/** Plus right now: this phone's live entitlement, or the couple's (either partner may pay). */
export function isPlusNow(): boolean {
  if (usePurchasesStore.getState().entitlement.active) return true;
  return getEffectiveTier(useAuthStore.getState().user, useRelationshipStore.getState().relationship) === 'plus';
}

export function isTrialNow(): boolean {
  const { entitlement } = usePurchasesStore.getState();
  if (entitlement.active) return entitlement.trial;
  return isRelationshipTrial(useRelationshipStore.getState().relationship);
}

/** Opens the paywall naming the feature that was hit. Returns false so callers can `return requirePlusNow(...)`. */
export function requirePlusNow(featureLabel: string): boolean {
  if (isPlusNow()) return true;
  useUIStore.getState().openPaywall(featureLabel);
  return false;
}

export type PlusErrorCode = 'PLUS_REQUIRED' | 'AI_MONTHLY_CAP';

export function plusErrorCode(error: unknown): PlusErrorCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'PLUS_REQUIRED' || code === 'AI_MONTHLY_CAP' ? code : null;
}

/**
 * Reacts to the server's Plus errors on AI features. Returns true when it handled one:
 * free → the paywall; the monthly fair use cap → a note (the game goes on with our own rounds).
 */
export function handlePlusError(error: unknown, featureLabel = 'AI games and questions'): boolean {
  const code = plusErrorCode(error);
  if (!code) return false;
  if (code === 'PLUS_REQUIRED') useUIStore.getState().openPaywall(featureLabel);
  else Alert.alert('Monthly AI limit reached', 'You’ve used this month’s AI games. They reset next month.');
  return true;
}
