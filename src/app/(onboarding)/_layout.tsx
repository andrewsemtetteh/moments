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
      <Stack.Screen name="profile-name" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="profile-gender" />
      <Stack.Screen name="anniversary-setup" />
      <Stack.Screen name="relationship-type" />
      <Stack.Screen name="relationship-path" />
      <Stack.Screen name="create-relationship" />
      <Stack.Screen name="join-relationship" />
      <Stack.Screen name="theme-picker" />
      <Stack.Screen name="widget-prompt" />
      <Stack.Screen name="notification-prompt" />
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
