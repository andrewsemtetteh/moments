import type { Session, User } from '@supabase/supabase-js';

import { ensureValidSession, invalidateLocalSession, isJwtExpiredLike } from '@/lib/auth-token';
import { markIntroCompleted } from '@/lib/intro-storage';
import { setRememberMe } from '@/lib/remember-me-storage';
import { getSupabase } from '@/lib/supabase';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

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

export async function ensureUserProfile(authUser: User) {
  const existing = await api.fetchProfile(authUser.id);
  if (existing) return existing;

  const name =
    (typeof authUser.user_metadata?.name === 'string' && authUser.user_metadata.name) ||
    (typeof authUser.user_metadata?.full_name === 'string' && authUser.user_metadata.full_name) ||
    authUser.email?.split('@')[0] ||
    'User';

  return api.createProfile({
    id: authUser.id,
    email: authUser.email ?? '',
    name,
  });
}

export type HydrateAuthOptions = {
  /** Fresh session from sign-in/sign-up — skip refreshSession round-trip. */
  trustSession?: boolean;
};

let hydrateInFlight: Promise<void> | null = null;
let hydrateInFlightUserId: string | null = null;

async function runHydrateAuthSession(
  session: Session,
  retried: boolean,
  options: HydrateAuthOptions,
): Promise<void> {
  const activeSession = options.trustSession
    ? session
    : await ensureValidSession(session);

  if (!activeSession?.user) {
    await invalidateLocalSession();
    return;
  }

  try {
    const [profile, { relationship, partner }] = await withTimeout(
      Promise.all([
        ensureUserProfile(activeSession.user),
        api.fetchRelationship(activeSession.user.id),
      ]),
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
  } catch (error) {
    if (isJwtExpiredLike(error) && !retried) {
      const refreshed = await ensureValidSession();
      if (refreshed?.user) {
        return runHydrateAuthSession(refreshed, true, { trustSession: true });
      }
      await invalidateLocalSession();
      return;
    }
    throw error;
  }
}

/** Hydrate profile + relationship into stores. Concurrent calls for the same user share one request. */
export async function hydrateAuthSession(
  session: Session,
  retried = false,
  options: HydrateAuthOptions = {},
): Promise<void> {
  const userId = session.user?.id ?? null;

  if (hydrateInFlight && hydrateInFlightUserId === userId) {
    return hydrateInFlight;
  }

  // Already hydrated this user (e.g. login finished before AuthSync SIGNED_IN).
  const existing = useAuthStore.getState().user;
  if (
    !retried &&
    options.trustSession !== true &&
    existing?.id &&
    existing.id === userId &&
    useAuthStore.getState().session
  ) {
    return;
  }

  const pending = runHydrateAuthSession(session, retried, options).finally(() => {
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
 * 2. Turn off remember-me so cold start cannot restore a session
 * 3. Briefly try remote revoke while tokens still exist
 * 4. Always clear the local Supabase session
 */
export async function signOutUser(): Promise<void> {
  const { queryClient } = await import('@/providers/AppProviders');
  queryClient.clear();
  await clearAuthSession();

  // Prevent AuthSync bootstrap from restoring a session after logout.
  void setRememberMe(false).catch(() => undefined);

  const supabase = getSupabase();

  // Revoke on the server while tokens are still available (short cap so logout stays snappy).
  await Promise.race([
    supabase.auth
      .signOut({ scope: 'global' })
      .then(() => undefined)
      .catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 800)),
  ]);

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Local stores are already cleared.
  }
}
