import Svg, { Circle, Path } from 'react-native-svg';

export const CROWN_GOLD = '#FFC83D';
const CROWN_EDGE = '#C98A00';

/**
 * A crown (the icon set has none). Gold with a darker edge by default: whoever's ahead. With `color`
 * it's one flat colour, as an icon: Moments Plus on badges and buttons. `size` is its width.
 */
export function Crown({ size = 24, color }: { size?: number; color?: string }) {
  const fill = color ?? CROWN_GOLD;
  const edge = color ?? CROWN_EDGE;
  return (
    <Svg
      width={size}
      height={(size * 19) / 26}
      viewBox="-1 0 26 19"
      accessibilityElementsHidden
      importantForAccessibility="no">
      <Path
        d="M2 5.5 L7 10 L12 2.5 L17 10 L22 5.5 L20 16 H4 Z"
        fill={fill}
        stroke={edge}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Circle cx={2} cy={5.5} r={1.6} fill={fill} stroke={edge} strokeWidth={1} />
      <Circle cx={12} cy={2.5} r={1.6} fill={fill} stroke={edge} strokeWidth={1} />
      <Circle cx={22} cy={5.5} r={1.6} fill={fill} stroke={edge} strokeWidth={1} />
    </Svg>
  );
}
