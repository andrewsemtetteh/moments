import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';

export default function LegalLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'default',
        // Without this, screens fall back to React Navigation's generic
        // light/dark background instead of the app's actual theme color,
        // showing a brief mismatched flash during the transition.
        contentStyle: { backgroundColor: colors.background },
        // Same as Notifications: swipe back from anywhere on the page.
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}>
      <Stack.Screen name="terms" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}
