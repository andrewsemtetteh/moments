import { useAuth, useUser } from '@clerk/expo';
import { ReactNode, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
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
import { BillingProvider } from '@/providers/BillingProvider';
import { CallProvider } from '@/providers/CallProvider';
import { useAuthStore, useUIStore } from '@/stores';

/** How long a saved copy of the app's data is good for at launch. */
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Kept at least as long as the saved copy, so it can be restored.
      gcTime: CACHE_MAX_AGE,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

/**
 * The app's data is saved on the phone, so opening it shows the last known
 * Home (moods, question, streak, moments…) at once and refreshes quietly,
 * instead of each part popping in on its own as it loads.
 */
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'moments-query-cache-v1',
  throttleTime: 1500,
});

/** Signing out (or switching account) forgets the saved copy too. */
function forgetCache() {
  queryClient.clear();
  void persister.removeClient();
}

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
      const saved = await getSavedTheme().catch(() => null);
      useUIStore.setState(saved ? { theme: saved, themeReady: true } : { themeReady: true });
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
            forgetCache();
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
          forgetCache();
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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        // Only finished, successful data is worth restoring.
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' },
      }}>
      <BillingProvider>
        <AuthSync>
          <CallProvider>{children}</CallProvider>
        </AuthSync>
      </BillingProvider>
    </PersistQueryClientProvider>
  );
}

export { queryClient };
