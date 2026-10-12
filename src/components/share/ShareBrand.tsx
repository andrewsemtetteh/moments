import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

const LOGO = require('../../../assets/images/moments.png');
/** moments.png is 2000 × 1111. */
const LOGO_RATIO = 2000 / 1111;

/**
 * The app's mark on every shareable image: the logo and name in a small white pill, so it reads on
 * any card colour and anyone who sees the image knows where it came from.
 */
export function ShareBrand({ size = 'md', style }: { size?: 'sm' | 'md' | 'lg'; style?: StyleProp<ViewStyle> }) {
  const s = SIZES[size];
  return (
    <View style={[styles.pill, { height: s.h, paddingHorizontal: s.pad, borderRadius: s.h / 2, gap: s.gap }, style]}>
      <Image source={LOGO} style={{ width: s.logo * LOGO_RATIO, height: s.logo }} contentFit="contain" />
      <Text style={[styles.name, { fontSize: s.font }]}>Moments</Text>
    </View>
  );
}

const SIZES = {
  sm: { h: 24, pad: 9, gap: 5, logo: 11, font: 11 },
  md: { h: 28, pad: 11, gap: 6, logo: 13, font: 13 },
  lg: { h: 40, pad: 16, gap: 8, logo: 19, font: 18 },
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
