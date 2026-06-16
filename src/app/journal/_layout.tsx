import { Stack } from 'expo-router';

import { resolveThemeColors } from '@/constants/design-system';
import { useUIStore } from '@/stores';

export default function JournalLayout() {
  const theme = useUIStore((s) => s.theme);
  const colors = resolveThemeColors(theme);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="compose" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
