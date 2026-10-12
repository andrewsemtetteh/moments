import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';

export default function PlayLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'default',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
