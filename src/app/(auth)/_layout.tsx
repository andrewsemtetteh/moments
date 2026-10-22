import { Redirect, Stack } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export default function AuthLayout() {
  const { colors } = useTheme();
  // Settings › Developer › Preview sign-in screens: the "Exit preview" pill is DevPreviewExit, at the root.

  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.flex}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          // Without this, screens fall back to React Navigation's generic
          // light/dark background instead of the app's actual theme color,
          // showing a brief mismatched flash during the transition.
          contentStyle: { backgroundColor: colors.background },
          // Swipe-to-go-back is intentionally off app-wide — the back button is
          // the only way back, here and everywhere else. `gestureEnabled` alone
          // only kills the edge-swipe; `fullScreenGestureEnabled` is the separate
          // iOS flag that otherwise still lets a swipe from anywhere on screen
          // through, so both need to be off to fully prevent swiping between
          // these screens.
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        {/* The one auth screen you can swipe back from: right, to the welcome slides. */}
        <Stack.Screen
          name="get-started"
          options={{ animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }}
        />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup-email" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="check-email" />
        <Stack.Screen name="reset-password" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
