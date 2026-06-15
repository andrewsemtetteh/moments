import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { MoodHistoryModal } from '@/components/home/MoodHistoryModal';
import { JournalModal } from '@/components/journal/JournalModal';
import { MomentCreatorModal } from '@/components/moments/MomentCreatorModal';
import { MomentHistoryModal } from '@/components/moments/MomentHistoryModal';
import { MomentStoryViewer } from '@/components/moments/MomentStoryViewer';
import { PaywallModal } from '@/components/subscription/PaywallModal';
import { WrappedModal } from '@/components/wrapped/WrappedModal';
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
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pro" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      {Platform.OS !== 'web' && (
        <>
          <MomentCreatorModal />
          <MomentHistoryModal />
          <MomentStoryViewer />
          <JournalModal />
          <WrappedModal />
          <MoodHistoryModal />
          <PaywallModal />
        </>
      )}
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
