import type { Session, User } from '@supabase/supabase-js';

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

export async function hydrateAuthSession(session: Session) {
  const profile = await ensureUserProfile(session.user);
  useAuthStore.getState().setUser(profile);
  useAuthStore.getState().setSession(true);

  const { relationship, partner } = await api.fetchRelationship(session.user.id);
  useRelationshipStore.getState().setRelationship(relationship);
  useRelationshipStore.getState().setPartner(partner);
}

export async function clearAuthSession() {
  useAuthStore.getState().reset();
  useRelationshipStore.getState().reset();
}
