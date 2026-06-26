import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ThemeColors } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';

/** Deep vertical auth gradient — matches get-started, derived from the active theme. */
export function getAuthEntryGradient(colors: ThemeColors): [string, string, string] {
  if (colors.isDark) {
    return [colors.accentMuted, colors.gradientHero[1], colors.background];
  }
  return [colors.background, colors.accentSoft, colors.backgroundElevated];
}

export function AuthEntryBackdrop({ children }: { children: ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={getAuthEntryGradient(colors)}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
});
