import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colorWithAlpha } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  children: ReactNode;
  /** Slightly stronger accent glow for hero screens. */
  vivid?: boolean;
};

export function WelcomeBackdrop({ children, vivid = false }: Props) {
  const { colors } = useTheme();
  const orbScale = vivid ? 1.15 : 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={colors.gradientHero}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.orb,
          styles.orbPrimary,
          {
            backgroundColor: colors.accentSoft,
            width: 300 * orbScale,
            height: 300 * orbScale,
          },
        ]}
      />
      <View
        style={[
          styles.orb,
          styles.orbSecondary,
          {
            backgroundColor: colorWithAlpha(colors.gradient[1], colors.isDark ? 0.22 : 0.28),
            width: 240 * orbScale,
            height: 240 * orbScale,
          },
        ]}
      />
      <View
        style={[
          styles.orb,
          styles.orbTertiary,
          {
            backgroundColor: colorWithAlpha(colors.gradient[0], colors.isDark ? 0.14 : 0.18),
            width: 160 * orbScale,
            height: 160 * orbScale,
          },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 999 },
  orbPrimary: { top: -90, right: -70 },
  orbSecondary: { bottom: 100, left: -80 },
  orbTertiary: { top: '38%', right: -50 },
});
