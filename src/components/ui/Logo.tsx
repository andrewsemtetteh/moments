import { Image, type ImageStyle } from 'expo-image';
import { StyleProp, View } from 'react-native';

import { MOMENTS_LOGO_PNG, MOMENTS_LOGO_SVG } from '@/constants/brand-assets';
import { useTheme } from '@/hooks/useTheme';

type LogoMarkProps = {
  size?: number;
  /** SVG scales cleanly in UI; PNG for contexts that need a raster source. */
  variant?: 'svg' | 'png';
  style?: StyleProp<ImageStyle>;
};

export function LogoMark({ size = 72, variant = 'svg', style }: LogoMarkProps) {
  return (
    <Image
      source={variant === 'png' ? MOMENTS_LOGO_PNG : MOMENTS_LOGO_SVG}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessibilityLabel="Moments"
    />
  );
}

export function LogoBadge({ size = 88 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      <LogoMark size={size * 0.62} />
    </View>
  );
}
