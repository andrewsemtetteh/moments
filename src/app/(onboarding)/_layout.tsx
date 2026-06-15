import { Platform } from 'react-native';
import { Redirect, Stack } from 'expo-router';

export default function OnboardingLayout() {
  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="create-relationship" />
      <Stack.Screen name="join-relationship" />
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
