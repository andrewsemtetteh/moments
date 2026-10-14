import { Redirect, Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export default function OnboardingLayout() {
  const { colors } = useTheme();

  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        // Without this, screens fall back to React Navigation's generic
        // light/dark background instead of the app's actual theme color,
        // showing a brief mismatched flash during the transition.
        contentStyle: { backgroundColor: colors.background },
      }}>
      {/* The flow (lib/onboarding-v2): about-you → together-since →
          relationship-kind → goals → your-plan → theme-picker → widget-prompt
          → invite → notification-prompt → tracking → /pro. */}
      {/* First step after sign-up: no swiping back to the auth screens. */}
      <Stack.Screen name="about-you" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <Stack.Screen name="together-since" />
      <Stack.Screen name="relationship-kind" />
      <Stack.Screen name="space-name" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="your-plan" />
      <Stack.Screen name="invite" />
      <Stack.Screen name="tracking" />
      <Stack.Screen name="join-relationship" />
      <Stack.Screen name="theme-picker" />
      <Stack.Screen name="widget-prompt" />
      <Stack.Screen name="notification-prompt" />
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
