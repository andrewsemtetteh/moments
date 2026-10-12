import { StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/**
 * A dashed circle outline with even, rounded dashes. A plain `borderStyle: 'dashed'` on a small
 * circle renders as uneven specks on iOS, so circles draw their dashes here instead.
 * Sits absolutely over its parent, which keeps its own size and fill.
 */
export function DashedRing({
  size,
  color,
  width = 2,
  dashes,
}: {
  size: number;
  color: string;
  width?: number;
  /** How many dashes around the ring. Defaults to roughly one per 8px of circumference. */
  dashes?: number;
}) {
  const r = (size - width) / 2;
  const circumference = 2 * Math.PI * r;
  const count = dashes ?? Math.max(8, Math.round(circumference / 8));
  const step = circumference / count;
  // Round caps add `width` to each dash, so take it back out of the dash and give it to the gap.
  const dash = Math.max(0.1, step * 0.55 - width);
  const gap = step - dash;

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={width}
        strokeDasharray={`${dash} ${gap}`}
        strokeLinecap="round"
        fill="none"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
