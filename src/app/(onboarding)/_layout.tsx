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
        // Swipe right to go back is OnboardingStepScreen's own gesture, on both
        // platforms. iPhone's native one stays off: running both popped two
        // steps at once, and it skipped a screen's own Back (the widget
        // how-to, the join screen).
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
      }}>
      {/* The flow (lib/onboarding-v2): about-you → together-since →
          relationship-kind → space-name → goals → your-plan → birthday → theme-picker →
          widget-prompt → invite → notification-prompt → tracking → /pro.
          Android skips widget-prompt and tracking. */}
      <Stack.Screen name="about-you" />
      <Stack.Screen name="birthday" />
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
    </Stack>
  );
}
