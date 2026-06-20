import { ReactNode, useEffect } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

import { clearAuthSession, hydrateAuthSession } from '@/lib/auth-session';
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

  useEffect(() => {
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        const rememberMe = await getRememberMe();
        if (!rememberMe) {
          queryClient.clear();
          await supabase.auth.signOut({ scope: 'local' });
          await clearAuthSession();
          return;
        }

        queryClient.clear();
        if (session?.user) {
          await hydrateAuthSession(session);
        } else {
          await clearAuthSession();
        }
      } finally {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      try {
        queryClient.clear();
        if (session?.user) {
          await hydrateAuthSession(session);
        } else {
          await clearAuthSession();
        }
      } finally {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeNet();
    };
  }, [setLoading, setOffline]);

  return <>{children}</>;
}

function WebProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
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
