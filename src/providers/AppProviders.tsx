import { useAuth, useUser } from '@clerk/expo';
import { ReactNode, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Font from 'expo-font';

import {
  WORDMARK_FONT_ASSET,
  WORDMARK_FONT_FAMILY,
  WORDMARK_FONT_FAMILY_ITALIC,
  WORDMARK_FONT_ITALIC_ASSET,
} from '@/constants/fonts';
import { clearAuthSession, hydrateAuthSession } from '@/lib/auth-session';
import { getRememberMe } from '@/lib/remember-me-storage';
import { getSavedTheme } from '@/lib/theme-storage';
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
  const { isLoaded, isSignedIn, userId, signOut } = useAuth();
  const { user } = useUser();
  const setLoading = useAuthStore((s) => s.setLoading);
  const setOffline = useUIStore((s) => s.setOffline);
  const checkedRememberMeRef = useRef(false);

  useEffect(() => {
    void Ionicons.loadFont();
    void Font.loadAsync({
      [WORDMARK_FONT_FAMILY]: WORDMARK_FONT_ASSET,
      [WORDMARK_FONT_FAMILY_ITALIC]: WORDMARK_FONT_ITALIC_ASSET,
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const saved = await getSavedTheme();
      if (saved) useUIStore.setState({ theme: saved });
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected);
    });

    return () => unsubscribeNet();
  }, [setOffline, setLoading]);

  // Failsafe: if Clerk never reports loaded (offline, slow network, Expo Go),
  // stop waiting after a while and treat the user as signed out rather than
  // leaving the splash up forever. If Clerk loads later, the effect below still runs.
  useEffect(() => {
    if (Platform.OS === 'web' || isLoaded) return;
    const timer = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [isLoaded, setLoading]);

  useEffect(() => {
    if (Platform.OS === 'web' || !isLoaded) return;

    void (async () => {
      try {
        // "Remember me" opt-out: sign out a session Clerk restored from the
        // keychain if the user asked not to be kept signed in. Only checked once.
        if (!checkedRememberMeRef.current) {
          checkedRememberMeRef.current = true;
          if (isSignedIn && !(await getRememberMe())) {
            queryClient.clear();
            await clearAuthSession();
            await signOut().catch(() => undefined);
            return;
          }
        }

        if (isSignedIn && userId) {
          const existingUser = useAuthStore.getState().user;
          // Login/signup already hydrated this user — share/skip, don't wipe caches.
          if (existingUser?.id === userId && useAuthStore.getState().session) {
            return;
          }
          await hydrateAuthSession({
            id: userId,
            email: user?.primaryEmailAddress?.emailAddress ?? null,
            name: user?.fullName ?? null,
          });
        } else {
          queryClient.clear();
          await clearAuthSession();
        }
      } catch {
        await clearAuthSession();
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, userId, user, signOut, setLoading]);

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
