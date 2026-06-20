import { Redirect, Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function AuthLayout() {
  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="check-email" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
