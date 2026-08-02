import { ReactNode, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import Ionicons from '@expo/vector-icons/Ionicons';

import { clearAuthSession, hydrateAuthSession } from '@/lib/auth-session';
import { ensureValidSession, invalidateLocalSession } from '@/lib/auth-token';
import { getRememberMe } from '@/lib/remember-me-storage';
import { getSupabase } from '@/lib/supabase';
import { CallProvider } from '@/providers/CallProvider';
import { useAuthStore, useUIStore } from '@/stores';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

function AuthSync({ children }: { children: ReactNode }) {
  const setLoading = useAuthStore((s) => s.setLoading);
  const setOffline = useUIStore((s) => s.setOffline);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    void Ionicons.loadFont();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    supabase.auth.startAutoRefresh();

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
        void ensureValidSession().catch(() => undefined);
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    });

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected);
    });

    void (async () => {
      try {
        const rememberMe = await getRememberMe();
        if (!rememberMe) {
          queryClient.clear();
          await invalidateLocalSession();
          return;
        }

        const activeSession = await ensureValidSession();
        queryClient.clear();
        if (activeSession?.user) {
          await hydrateAuthSession(activeSession);
        } else {
          await clearAuthSession();
        }
      } catch {
        queryClient.clear();
        await invalidateLocalSession();
      } finally {
        bootstrappedRef.current = true;
        setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;

      // Never await inside onAuthStateChange — it blocks Supabase's auth lock and breaks refresh.
      queueMicrotask(() => {
        void (async () => {
          if (!bootstrappedRef.current && event === 'SIGNED_IN') return;

          try {
            if (session?.user) {
              const existingUser = useAuthStore.getState().user;
              // Login/signup already hydrated this user — share/skip, don't wipe caches.
              if (event === 'SIGNED_IN' && existingUser?.id === session.user.id) {
                setLoading(false);
                return;
              }
              // Do not clear the query cache on SIGNED_IN — that races login hydrate.
              await hydrateAuthSession(session, false, {
                trustSession: event === 'SIGNED_IN',
              });
            } else {
              queryClient.clear();
              await clearAuthSession();
            }
          } catch {
            await invalidateLocalSession();
          } finally {
            setLoading(false);
          }
        })();
      });
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeNet();
      appStateSub.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, [setLoading, setOffline]);

  return <>{children}</>;
}

function WebProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    void Ionicons.loadFont();
    useAuthStore.getState().setLoading(false);
  }, []);
  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') {
    return <WebProviders>{children}</WebProviders>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync>
        <CallProvider>{children}</CallProvider>
      </AuthSync>
    </QueryClientProvider>
  );
}

export { queryClient };
