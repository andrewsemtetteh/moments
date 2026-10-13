import { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';

/** The official mark's coral (assets/branding/moments-e8). */
const CORAL = '#FF4D6D';
const HEART_PATH =
  'M50 72 C34 61 26 52 26 42 C26 34 32 29 39 29 C44 29 48 32 50 36 C52 32 56 29 61 29 C68 29 74 34 74 42 C74 52 66 61 50 72 Z';

/** Full detail: the heart cut flat, two lines cut to its outline, a dot at the tip. */
const FULL = {
  cut: 61.5,
  stroke: 3.4,
  lines: [
    [32.68, 67.32, 66.35],
    [39.66, 60.34, 72.91],
  ],
  dot: { cy: 79.86, r: 2.1 },
};
/** Below ~40 px: one thicker line so it stays clear. */
const SMALL = {
  cut: 63,
  stroke: 6.5,
  lines: [[36.93, 63.07, 69.08]],
  dot: { cy: 78.56, r: 3.4 },
};

type LogoMarkProps = {
  size?: number;
  /** Force the small, one-line version (used automatically below 40 px). */
  simple?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The official Moments mark (E8): a coral heart whose lower half is drawn as
 * lines that taper to a dot. Transparent and all coral, so it reads on light
 * and dark themes alike; drawn as a vector so it's crisp at any size.
 */
export function LogoMark({ size = 72, simple, style }: LogoMarkProps) {
  const clipId = `cut-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const v = simple || size < 40 ? SMALL : FULL;

  return (
    <View style={[{ width: size, height: size }, style]} accessible accessibilityRole="image" accessibilityLabel="Moments">
      {/* Square box around the mark's centre. */}
      <Svg width={size} height={size} viewBox="14 14 72 72">
        <Defs>
          <ClipPath id={clipId}>
            <Rect x={0} y={0} width={100} height={v.cut} />
          </ClipPath>
        </Defs>
        <G transform="translate(0 -6.59)">
          <G clipPath={`url(#${clipId})`}>
            <Path d={HEART_PATH} fill={CORAL} transform="translate(50 56) scale(1.18) translate(-50 -50)" />
          </G>
          {v.lines.map(([x1, x2, y]) => (
            <Line key={y} x1={x1} y1={y} x2={x2} y2={y} stroke={CORAL} strokeWidth={v.stroke} strokeLinecap="round" />
          ))}
          <Circle cx={50} cy={v.dot.cy} r={v.dot.r} fill={CORAL} />
        </G>
      </Svg>
    </View>
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
