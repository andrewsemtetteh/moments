import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppErrorScreen } from '@/components/layout/AppErrorScreen';
import { AppModals } from '@/components/layout/AppModals';
import { SubscriptionSync } from '@/components/layout/SubscriptionSync';
import { DynamicIslandHost } from '@/components/layout/DynamicIslandHost';
import { PermissionSheetHost } from '@/components/layout/PermissionSheetHost';
import { ReferralClaimSync } from '@/components/layout/ReferralClaimSync';
import { resolveThemeColors } from '@/constants/design-system';
import { identifyUser, initMonitoring, Sentry } from '@/lib/monitoring';
import { AppProviders } from '@/providers/AppProviders';
import { useAuthStore, useUIStore } from '@/stores';

// Crash reporting first, so even start-up errors are caught.
initMonitoring();
// Reports carry the account id (nothing else), set and cleared with sign-in.
useAuthStore.subscribe((state, prev) => {
  if (state.user?.id !== prev.user?.id) identifyUser(state.user?.id ?? null);
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

if (!publishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add your key to .env.local.\nRun: 1) clerk auth login  2) clerk link  3) clerk env pull, then restart the dev server.',
  );
}

// Hold the native splash until the first screen (src/app/index.tsx) is ready
// to take over, then cross-fade into it instead of a hard cut.
void SplashScreen.preventAutoHideAsync();
// setOptions is a no-op (and warns) in Expo Go — it only works in dev builds.
if (Constants.appOwnership !== 'expo') {
  SplashScreen.setOptions({ fade: true, duration: 400 });
}

function RootStack() {
  const theme = useUIStore((s) => s.theme);
  const colors = resolveThemeColors(theme);

  return (
    <ThemeProvider value={colors.isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <DynamicIslandHost>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'fade',
          }}>
          <Stack.Screen name="index" />
          {/* Belt-and-suspenders alongside the (auth) group's own stack-level
            setting — this is the top-level entry a swipe-back gesture would
            otherwise reveal (the splash/index screen) if anything upstream
            ever reaches here via push instead of replace. */}
          {/* Leaving the launch screen is an instant switch (no fade), into any of these three. */}
          <Stack.Screen name="(auth)" options={{ gestureEnabled: false, fullScreenGestureEnabled: false, animation: 'none' }} />
          {/* Onboarding can never be swiped away back to sign-up, however it was
              reached (email, Apple, Google, login). Steps still swipe between
              themselves inside the group's own stack. */}
          <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false, fullScreenGestureEnabled: false, animation: 'none' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          {/* Chat, Notifications and Settings: the platform's own push
            (`default` = the real UIKit transition on iOS, not a JS/custom
            animator), closed by swiping right from anywhere on the screen —
            the swipe tracks your finger and can be cancelled midway.
            Chat's reply gesture is a LEFT swipe so it never fights this. */}
          <Stack.Screen
            name="chat"
            options={{ animation: 'default', gestureEnabled: true, fullScreenGestureEnabled: true }}
          />
          <Stack.Screen
            name="notifications"
            options={{ animation: 'default', gestureEnabled: true, fullScreenGestureEnabled: true }}
          />
          <Stack.Screen
            name="settings"
            options={{ animation: 'default', gestureEnabled: true, fullScreenGestureEnabled: true }}
          />
          {/* Streak: opened from Home's streak pill; same push + swipe back as Settings. */}
          <Stack.Screen
            name="streak"
            options={{ animation: 'default', gestureEnabled: true, fullScreenGestureEnabled: true }}
          />
          {/* Plan opens from its top-left icon, so it slides in from the left and
            closes by swiping LEFT from anywhere. `animationMatchesGesture`
            makes the native swipe follow that inverted direction instead of
            the usual right-swipe. */}
          <Stack.Screen
            name="calendar"
            options={{
              animation: 'slide_from_left',
              animationMatchesGesture: true,
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="question-history"
            options={{ animation: 'default', gestureEnabled: true, fullScreenGestureEnabled: true }}
          />
          <Stack.Screen
            name="question-history/[id]"
            options={{ animation: 'default', gestureEnabled: true, fullScreenGestureEnabled: true }}
          />
          <Stack.Screen
            name="play"
            options={{ animation: 'default', gestureEnabled: true, fullScreenGestureEnabled: true }}
          />
          {/* Opens like Notifications: slides in from the right, swipe back from anywhere. */}
          <Stack.Screen
            name="legal"
            options={{ animation: 'default', gestureEnabled: true, fullScreenGestureEnabled: true }}
          />
          {/* The sign-up Plus step (in the app, Plus opens as an overlay — see
            PaywallModal). A plain screen, not a modal: finishing onboarding
            replaces it with Home, and inside a modal that left Home stuck in a
            card with a curved top that dragged down. */}
          <Stack.Screen name="pro" options={{ animation: 'fade', gestureEnabled: false }} />
          {/* Invite a couple: both get 14 days of Plus (paywall, Settings, You page). */}
          <Stack.Screen
            name="refer"
            options={{ animation: 'default', gestureEnabled: true, fullScreenGestureEnabled: true }}
          />
        </Stack>
        <AppModals />
        <SubscriptionSync />
        <ReferralClaimSync />
        {/* "Why we need this" before camera / mic / location / photos (see lib/permissions). */}
        <PermissionSheetHost />
      </DynamicIslandHost>
    </ThemeProvider>
  );
}

/** A crash while drawing any screen shows this (and is reported) instead of a blank screen. */
export { AppErrorScreen as ErrorBoundary };

function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <GestureHandlerRootView style={styles.root}>
        <AppProviders>
          <RootStack />
        </AppProviders>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

// Sentry.wrap captures crashes and screen timings from the root down.
export default Sentry.wrap(RootLayout);
