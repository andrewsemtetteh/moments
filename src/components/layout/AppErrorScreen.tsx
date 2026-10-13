import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/ui/Logo';
import { resolveThemeColors } from '@/constants/design-system';
import { reportError } from '@/lib/monitoring';
import { useUIStore } from '@/stores';

/**
 * Shown instead of a blank screen when something crashes while drawing a
 * screen (Expo Router's ErrorBoundary). Reports it, then offers Try again.
 * Uses the stored theme directly: providers above it may be what broke.
 */
export function AppErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const colors = resolveThemeColors(useUIStore.getState().theme);

  useEffect(() => {
    reportError(error, { where: 'ErrorBoundary' });
  }, [error]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.body}>
        <LogoMark size={72} />
        <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          Sorry about that. We’ve been told about it. Try again, and if it keeps happening, restart the app.
        </Text>
        {__DEV__ ? (
          <Text style={[styles.dev, { color: colors.textTertiary }]} numberOfLines={6}>
            {error.message}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => void retry()}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, { backgroundColor: colors.text, opacity: pressed ? 0.85 : 1 }]}>
        <Text style={[styles.buttonText, { color: colors.background }]}>Try again</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingBottom: 16 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center', marginTop: 8 },
  text: { fontSize: 16, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  dev: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  button: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 17, fontWeight: '800' },
});
