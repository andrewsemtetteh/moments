import { Redirect, Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export default function AuthLayout() {
  const { colors } = useTheme();

  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        // Without this, screens fall back to React Navigation's generic
        // light/dark background instead of the app's actual theme color,
        // showing a brief mismatched flash during the transition.
        contentStyle: { backgroundColor: colors.background },
        // Swipe-to-go-back is intentionally off app-wide — the back button is
        // the only way back, here and everywhere else. `gestureEnabled` alone
        // only kills the edge-swipe; `fullScreenGestureEnabled` is the separate
        // iOS flag that otherwise still lets a swipe from anywhere on screen
        // through, so both need to be off to fully prevent swiping between
        // these screens.
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
      }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="get-started" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="intro" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="signup-email" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="check-email" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
