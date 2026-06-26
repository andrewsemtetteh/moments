import type { Session } from '@supabase/supabase-js';

import { isJwtExpiredError } from '@/lib/network-error';
import { getSupabase } from '@/lib/supabase';

const EXPIRY_BUFFER_SEC = 60;

export function isAccessTokenExpired(session: Session | null | undefined): boolean {
  if (!session?.expires_at) return !session;
  const now = Math.floor(Date.now() / 1000);
  return session.expires_at <= now + EXPIRY_BUFFER_SEC;
}

let refreshInFlight: Promise<Session | null> | null = null;

/** Refresh the stored session when the access token is expired or close to expiring. */
export async function ensureValidSession(
  session?: Session | null,
): Promise<Session | null> {
  const supabase = getSupabase();
  const current = session ?? (await supabase.auth.getSession()).data.session;
  if (!current) return null;
  if (!isAccessTokenExpired(current)) return current;

  if (!refreshInFlight) {
    refreshInFlight = supabase.auth
      .refreshSession()
      .then(({ data: { session: refreshed }, error }) => {
        if (error || !refreshed || isAccessTokenExpired(refreshed)) return null;
        return refreshed;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export async function invalidateLocalSession(): Promise<void> {
  const supabase = getSupabase();
  await supabase.auth.signOut({ scope: 'local' });
  const { clearAuthSession } = await import('@/lib/auth-session');
  await clearAuthSession();
}

export function isJwtExpiredLike(error: unknown): boolean {
  return isJwtExpiredError(error);
}
