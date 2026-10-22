import { type StyleProp, type ViewStyle, View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';

const INK = '#000000';

/**
 * The birthday cake, in the same sticker style as the streak flame and the together
 * heart: thick ink outlines, two tiers with dripping icing, sprinkles and one candle.
 * Drawn in a 120 × 120 box.
 */
export function StickerCake({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  // Outlines read the same at any size: thicker (in box units) when small.
  const stroke = size < 60 ? 6 : 4;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="-4 -4 128 128">
        {/* Plate */}
        <Ellipse cx={60} cy={108} rx={52} ry={8} fill="#FFFFFF" stroke={INK} strokeWidth={stroke} />
        {/* Bottom tier and its icing */}
        <Rect x={12} y={64} width={96} height={42} rx={10} fill="#FF7FA3" stroke={INK} strokeWidth={stroke} />
        <Path
          d="M12 74 Q12 64 22 64 L98 64 Q108 64 108 74 L108 79 Q102 88 96 79 Q90 71 84 81 Q78 90 72 80 Q66 71 60 81 Q54 90 48 80 Q42 71 36 81 Q30 90 24 80 Q18 72 12 82 Z"
          fill="#FFF3E0"
          stroke={INK}
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        {/* Top tier and its icing */}
        <Rect x={28} y={38} width={64} height={28} rx={8} fill="#FFD166" stroke={INK} strokeWidth={stroke} />
        <Path
          d="M28 46 Q28 38 36 38 L84 38 Q92 38 92 46 L92 49 Q87 56 82 49 Q77 43 72 51 Q67 57 62 50 Q57 43 52 51 Q47 57 42 50 Q37 44 32 51 Q29 54 28 52 Z"
          fill="#FFFFFF"
          stroke={INK}
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        {/* Candle and flame */}
        <Rect x={55} y={16} width={10} height={23} rx={3} fill="#7CC4FF" stroke={INK} strokeWidth={stroke} />
        <Path
          d="M60 -1 C66 6 68 10 66 14 C64 18 56 18 54 14 C52 10 55 6 60 -1 Z"
          fill="#FFB627"
          stroke={INK}
          strokeWidth={stroke * 0.8}
          strokeLinejoin="round"
        />
        {/* Sprinkles */}
        <Rect x={24} y={92} width={8} height={4} rx={2} fill="#7CC4FF" />
        <Rect x={44} y={96} width={8} height={4} rx={2} fill="#FFD166" />
        <Rect x={66} y={92} width={8} height={4} rx={2} fill="#FFFFFF" />
        <Rect x={86} y={96} width={8} height={4} rx={2} fill="#7CC4FF" />
        <Rect x={38} y={58} width={7} height={3.5} rx={1.75} fill="#FF7FA3" />
        <Rect x={74} y={58} width={7} height={3.5} rx={1.75} fill="#7CC4FF" />
        {/* Shine on the bottom tier */}
        <Path d="M20 90 L20 98" stroke="#FFC2D3" strokeWidth={5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
