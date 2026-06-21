import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppModals } from '@/components/layout/AppModals';
import { resolveThemeColors } from '@/constants/design-system';
import { AppProviders } from '@/providers/AppProviders';
import { useUIStore } from '@/stores';

function RootStack() {
  const theme = useUIStore((s) => s.theme);
  const colors = resolveThemeColors(theme);

  return (
    <ThemeProvider value={colors.isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="auth/callback" options={{ animation: 'none' }} />
        <Stack.Screen
          name="notifications"
          options={{
            animation: 'slide_from_right',
            presentation: 'card',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen name="journal" />
        <Stack.Screen name="pro" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <AppModals />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AppProviders>
        <RootStack />
      </AppProviders>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
