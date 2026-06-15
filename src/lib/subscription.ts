import type { Relationship, SubscriptionTier, UserProfile } from '@/types/database';

type SubscriptionFields = Pick<
  UserProfile,
  'subscription_tier' | 'subscription_expires_at'
>;

function normalizeTier(tier: string | undefined | null): SubscriptionTier {
  if (tier === 'plus' || tier === 'premium') return 'plus';
  return 'free';
}

/** True when the user has an active personal Plus entitlement. */
export function hasActiveUserSubscription(profile: SubscriptionFields | null | undefined): boolean {
  if (!profile?.subscription_tier || normalizeTier(profile.subscription_tier) === 'free') return false;
  if (!profile.subscription_expires_at) return true;
  return new Date(profile.subscription_expires_at) > new Date();
}

/** Effective tier for the current user in (or out of) a relationship. */
export function getEffectiveTier(
  user: UserProfile | null | undefined,
  relationship: Relationship | null | undefined,
): SubscriptionTier {
  const userHasPlus = hasActiveUserSubscription(user);

  if (!relationship || relationship.status === 'ended') {
    return userHasPlus ? 'plus' : 'free';
  }

  const relTier = normalizeTier(relationship.subscription_tier);
  if (relTier === 'plus' && relationship.subscription_owner_id) {
    return 'plus';
  }

  return userHasPlus ? 'plus' : 'free';
}

export function isSubscriptionOwner(
  userId: string | undefined,
  relationship: Relationship | null | undefined,
): boolean {
  return !!userId && !!relationship?.subscription_owner_id && relationship.subscription_owner_id === userId;
}

/** Only the payer can manage billing once RevenueCat is connected. */
export function canManageBilling(
  userId: string | undefined,
  relationship: Relationship | null | undefined,
  user: UserProfile | null | undefined,
): boolean {
  if (!userId || !user) return false;
  if (isSubscriptionOwner(userId, relationship)) return true;
  return hasActiveUserSubscription(user) && !relationship;
}

export function formatSubscriptionExpiry(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  return new Date(expiresAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
