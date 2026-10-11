import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppModals } from '@/components/layout/AppModals';
import { resolveThemeColors } from '@/constants/design-system';
import { AppProviders } from '@/providers/AppProviders';
import { useUIStore } from '@/stores';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (!publishableKey) {
  throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add your key to .env.local.\nRun: 1) clerk auth login  2) clerk link  3) clerk env pull — then restart the dev server.");
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
        <Stack.Screen
          name="(auth)"
          options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
        />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
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
        <Stack.Screen name="legal" />
        <Stack.Screen name="pro" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <AppModals />
    </ThemeProvider>
  );
}

export default function RootLayout() {
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