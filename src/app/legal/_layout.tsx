import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';

export default function LegalLayout() {
  const { colors } = useTheme();

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
        // the only way back, here and everywhere else.
        gestureEnabled: false,
      }}>
      <Stack.Screen name="terms" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}
