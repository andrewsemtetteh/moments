import { getClerkInstance } from '@clerk/expo';

import { markIntroCompleted } from '@/lib/intro-storage';
import { createProfile, fetchMyProfile, fetchMyRelationship } from '@/lib/moments-api';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

async function getApiToken(): Promise<string> {
  const token = await getClerkInstance().session?.getToken();
  if (!token) throw new Error('Not signed in');
  return token;
}

const HYDRATE_TIMEOUT_MS = 12_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out. Check your connection and try again.`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function prefetchHomeData(relationshipId: string, memberIds: string[]) {
  const { queryClient } = await import('@/providers/AppProviders');
  const { moodsQueryKey, warmDailyChallengeCache, warmStreakCache } = await import(
    '@/hooks/queries'
  );

  await Promise.all([
    warmStreakCache(queryClient, relationshipId),
    warmDailyChallengeCache(queryClient, relationshipId),
    queryClient.prefetchQuery({
      queryKey: moodsQueryKey(relationshipId),
      queryFn: () => api.fetchLatestMoods(relationshipId, memberIds),
    }),
  ]);
}

/** Minimal identity Clerk gives us — enough to create/look up our own `users` row. */
export type ClerkAuthUser = {
  id: string;
  email: string | null;
  name?: string | null;
};

export async function ensureUserProfile(authUser: ClerkAuthUser) {
  const token = await getApiToken();
  const existing = await fetchMyProfile(token);
  if (existing) return existing;

  const name = authUser.name?.trim() || authUser.email?.split('@')[0] || 'User';

  return createProfile(token, {
    email: authUser.email ?? '',
    name,
  });
}

let hydrateInFlight: Promise<void> | null = null;
let hydrateInFlightUserId: string | null = null;

async function runHydrateAuthSession(authUser: ClerkAuthUser): Promise<void> {
  const [profile, { relationship, partner }] = await withTimeout(
    Promise.all([ensureUserProfile(authUser), getApiToken().then(fetchMyRelationship)]),
    HYDRATE_TIMEOUT_MS,
    'Sign in',
  );

  useAuthStore.getState().setUser(profile);
  useAuthStore.getState().setSession(true);
  useRelationshipStore.getState().setRelationship(relationship);
  useRelationshipStore.getState().setPartner(partner);

  // Warm home caches in the background — never block sign-in / splash on this.
  if (relationship?.id) {
    const memberIds = [relationship.user_1_id, relationship.user_2_id, profile.id].filter(
      Boolean,
    ) as string[];
    void prefetchHomeData(relationship.id, memberIds).catch(() => undefined);
  }

  await markIntroCompleted();
}

/** Hydrate profile + relationship into stores. Concurrent calls for the same user share one request. */
export async function hydrateAuthSession(authUser: ClerkAuthUser): Promise<void> {
  const userId = authUser.id;

  if (hydrateInFlight && hydrateInFlightUserId === userId) {
    return hydrateInFlight;
  }

  // Already hydrated this user (e.g. a screen hydrated before the reactive AuthSync listener fired).
  const existing = useAuthStore.getState().user;
  if (existing?.id === userId && useAuthStore.getState().session) {
    return;
  }

  const pending = runHydrateAuthSession(authUser).finally(() => {
    if (hydrateInFlight === pending) {
      hydrateInFlight = null;
      hydrateInFlightUserId = null;
    }
  });

  hydrateInFlight = pending;
  hydrateInFlightUserId = userId;
  return pending;
}

export async function clearAuthSession() {
  useAuthStore.getState().reset();
  useRelationshipStore.getState().reset();
}

/**
 * Sign out quickly:
 * 1. Clear app state + query cache (UI can leave immediately)
 * 2. Revoke the Clerk session
 */
export async function signOutUser(): Promise<void> {
  const { queryClient } = await import('@/providers/AppProviders');
  queryClient.clear();
  await clearAuthSession();
  // Back to an anonymous RevenueCat user, so the next account here doesn't inherit Plus.
  const { resetPurchases } = await import('@/lib/purchases');
  await resetPurchases();

  try {
    await getClerkInstance().signOut();
  } catch {
    // Local stores are already cleared.
  }
}
