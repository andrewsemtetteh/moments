import type { Session, User } from '@supabase/supabase-js';

import { ensureValidSession, invalidateLocalSession, isJwtExpiredLike } from '@/lib/auth-token';
import { markIntroCompleted } from '@/lib/intro-storage';
import { getSupabase } from '@/lib/supabase';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

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

export async function hydrateAuthSession(session: Session, retried = false) {
  const activeSession = await ensureValidSession(session);
  if (!activeSession?.user) {
    await invalidateLocalSession();
    return;
  }

  try {
    const [profile, { relationship, partner }] = await Promise.all([
      ensureUserProfile(activeSession.user),
      api.fetchRelationship(activeSession.user.id),
    ]);

    useAuthStore.getState().setUser(profile);
    useAuthStore.getState().setSession(true);
    useRelationshipStore.getState().setRelationship(relationship);
    useRelationshipStore.getState().setPartner(partner);
    await markIntroCompleted();
  } catch (error) {
    if (isJwtExpiredLike(error) && !retried) {
      const refreshed = await ensureValidSession();
      if (refreshed?.user) {
        return hydrateAuthSession(refreshed, true);
      }
      await invalidateLocalSession();
      return;
    }
    throw error;
  }
}

export async function clearAuthSession() {
  useAuthStore.getState().reset();
  useRelationshipStore.getState().reset();
}

/** Sign out, clear cached queries, and reset local auth state. Falls back to local-only sign-out if the network fails. */
export async function signOutUser(): Promise<void> {
  const supabase = getSupabase();
  const { queryClient } = await import('@/providers/AppProviders');
  queryClient.clear();

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      await supabase.auth.signOut({ scope: 'local' });
    }
  } catch {
    await supabase.auth.signOut({ scope: 'local' });
  }

  await clearAuthSession();
}
