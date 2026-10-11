import { Image, type ImageStyle } from 'expo-image';
import { Platform, StyleProp, View } from 'react-native';

import { MOMENTS_LOGO_PNG, MOMENTS_LOGO_SVG } from '@/constants/brand-assets';
import { useTheme } from '@/hooks/useTheme';

type LogoMarkProps = {
  size?: number;
  /** SVG scales cleanly in UI; PNG for contexts that need a raster source. Defaults to
   * PNG on native — the source SVG lacks explicit width/height, which Metro's plain
   * (non-transformed) asset pipeline needs to size it correctly, so it fails to load
   * there. Web renders the SVG natively via the browser, so it defaults to SVG there. */
  variant?: 'svg' | 'png';
  style?: StyleProp<ImageStyle>;
};

export function LogoMark({
  size = 72,
  variant = Platform.OS === 'web' ? 'svg' : 'png',
  style,
}: LogoMarkProps) {
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
