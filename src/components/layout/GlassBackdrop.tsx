import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function GlassBackdrop({ children }: { children: ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient colors={colors.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.orb, styles.orbA, { backgroundColor: colors.accentSoft }]} />
      <View style={[styles.orb, styles.orbB, { backgroundColor: 'rgba(184,200,255,0.35)' }]} />
      <View style={[styles.orb, styles.orbC, { backgroundColor: 'rgba(255,184,208,0.28)' }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 999 },
  orbA: { width: 280, height: 280, top: -80, right: -60 },
  orbB: { width: 220, height: 220, bottom: 120, left: -70 },
  orbC: { width: 180, height: 180, top: '42%', right: -40 },
});
