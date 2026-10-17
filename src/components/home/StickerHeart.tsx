import { useId } from 'react';
import { type StyleProp, type ViewStyle, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/** A heart in a 120 × 108 box. */
const HEART =
  'M60 102 C54 97 16 72 9 46 C3 24 18 6 38 6 C49 6 56 12 60 21 C64 12 71 6 82 6 C102 6 117 24 111 46 C104 72 66 97 60 102 Z';
const INK = '#000000';

/**
 * The "together" heart, in the same sticker style as the streak flame: a thick
 * ink outline, a softly shaded pink fill, and a highlight on the top-left lobe.
 */
export function StickerHeart({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const h = (size * 108) / 120;
  // Outlines read the same at any size: thicker (in box units) when small.
  const stroke = size < 48 ? 9 : 4.5;

  return (
    <View style={[{ width: size, height: h }, style]}>
      <Svg width={size} height={h} viewBox="-6 -4 132 116">
        <Defs>
          <LinearGradient id={`h${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFA3BC" />
            <Stop offset="0.5" stopColor="#FF5C8A" />
            <Stop offset="1" stopColor="#E8336A" />
          </LinearGradient>
        </Defs>
        <Path d={HEART} fill={`url(#h${uid})`} stroke={INK} strokeWidth={stroke} strokeLinejoin="round" />
        {/* The shine on the left lobe. */}
        <Path d="M24 40 C23 30 29 22 38 21" fill="none" stroke="#FFD3DF" strokeWidth={7} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
