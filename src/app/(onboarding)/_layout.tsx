import { Redirect, Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function OnboardingLayout() {
  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="profile-name" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="profile-gender" />
      <Stack.Screen name="anniversary-setup" />
      <Stack.Screen name="relationship-type" />
      <Stack.Screen name="relationship-path" />
      <Stack.Screen name="create-relationship" />
      <Stack.Screen name="join-relationship" />
      <Stack.Screen name="notification-prompt" />
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
