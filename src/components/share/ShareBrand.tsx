import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { LogoMark } from '@/components/ui/Logo';

/**
 * The app's mark on every shareable image: the logo and name in a small white pill, so it reads on
 * any card colour and anyone who sees the image knows where it came from.
 */
export function ShareBrand({ size = 'md', style }: { size?: 'sm' | 'md' | 'lg'; style?: StyleProp<ViewStyle> }) {
  const s = SIZES[size];
  return (
    <View style={[styles.pill, { height: s.h, paddingHorizontal: s.pad, borderRadius: s.h / 2, gap: s.gap }, style]}>
      <LogoMark size={s.logo} simple />
      <Text style={[styles.name, { fontSize: s.font }]}>Moments</Text>
    </View>
  );
}

const SIZES = {
  sm: { h: 24, pad: 8, gap: 4, logo: 18, font: 11 },
  md: { h: 28, pad: 10, gap: 5, logo: 22, font: 13 },
  lg: { h: 40, pad: 14, gap: 6, logo: 32, font: 18 },
} as const;

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  name: { color: '#2B1B3D', fontWeight: '900', letterSpacing: -0.2 },
});
