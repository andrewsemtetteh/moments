import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Shape = 'triangle' | 'diamond' | 'circle' | 'square';

/** Kahoot's order: red triangle, blue diamond, yellow circle, green square (matches QUIZ_TILE_COLORS). */
const FOUR: Shape[] = ['triangle', 'diamond', 'circle', 'square'];
/** Two answers (true / false, this or that): blue diamond, red triangle (matches BOOL_TILE_COLORS). */
const TWO: Shape[] = ['diamond', 'triangle'];

/** The shape that marks answer `index` of `count`, so each option is known by its shape as well as its colour. */
export function answerShape(index: number, count: number): Shape {
  return count === 2 ? TWO[index % 2] : FOUR[index % 4];
}

/** A white answer shape, drawn on the answer's coloured tile. */
export function AnswerShape({
  index,
  count,
  size = 26,
  color = '#FFFFFF',
}: {
  index: number;
  count: number;
  size?: number;
  color?: string;
}) {
  const shape = answerShape(index, count);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {shape === 'triangle' ? <Path d="M12 3 L22 20.5 H2 Z" fill={color} strokeLinejoin="round" /> : null}
      {shape === 'diamond' ? <Path d="M12 2 L22 12 L12 22 L2 12 Z" fill={color} /> : null}
      {shape === 'circle' ? <Circle cx={12} cy={12} r={10} fill={color} /> : null}
      {shape === 'square' ? <Rect x={3} y={3} width={18} height={18} fill={color} /> : null}
    </Svg>
  );
}
