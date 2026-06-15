import { View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';

/** Two interlocking hearts forming the Moments mark. */
export function LogoMark({ size = 72 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgGradient id="moments-grad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.gradient[0]} />
          <Stop offset="1" stopColor={colors.gradient[1]} />
        </SvgGradient>
      </Defs>
      <Path
        d="M50 84C30 70 16 58 16 42c0-11 8-19 18-19 7 0 12 4 16 9 4-5 9-9 16-9 10 0 18 8 18 19 0 16-14 28-34 42Z"
        fill="url(#moments-grad)"
      />
      <Path
        d="M50 70c-8-6-16-13-19-21 3 4 7 6 12 6 3 0 5-1 7-2 2 1 4 2 7 2 5 0 9-2 12-6-3 8-11 15-19 21Z"
        fill={colors.background}
        opacity={0.22}
      />
    </Svg>
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
