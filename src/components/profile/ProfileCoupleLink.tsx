import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colorWithAlpha } from '@/components/ui/primitives';

const WIDTH = 112;
const HEIGHT = 58;

/**
 * Interlocking rings between the two avatars, joined to them by wavy bridges,
 * with a stroked heart sitting in the overlap (no chip behind it).
 * Rendered on top of the theme's hero gradient, so `ringColor` should be
 * whatever reads on that gradient (i.e. `colors.onAccent`), not a fixed white.
 */
export function ProfileCoupleLink({ accent, ringColor = '#FFFFFF' }: { accent: string; ringColor?: string }) {
  return (
    <View style={styles.wrap} accessibilityElementsHidden>
      <Svg width={WIDTH} height={HEIGHT}>
        <Defs>
          <LinearGradient id="ringFade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={ringColor} stopOpacity="0.3" />
            <Stop offset="0.5" stopColor={ringColor} stopOpacity="0.95" />
            <Stop offset="1" stopColor={ringColor} stopOpacity="0.3" />
          </LinearGradient>
        </Defs>

        {/* Wavy bridges from each avatar into the rings */}
        <Path
          d="M 0 29 Q 3.75 24 7.5 29 T 15 29 T 22.5 29 T 30 29"
          stroke="url(#ringFade)"
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 112 29 Q 108.25 24 104.5 29 T 97 29 T 89.5 29 T 82 29"
          stroke="url(#ringFade)"
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />

        {/* Left ring */}
        <Circle cx={42} cy={29} r={16} stroke={colorWithAlpha(ringColor, 0.9)} strokeWidth={2.1} fill="none" />
        {/* Right ring */}
        <Circle cx={70} cy={29} r={16} stroke={colorWithAlpha(ringColor, 0.9)} strokeWidth={2.1} fill="none" />

        {/* Soft highlight arcs */}
        <Path
          d="M 30 22 A 16 16 0 0 1 54 22"
          stroke={colorWithAlpha(ringColor, 0.32)}
          strokeWidth={1}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 58 22 A 16 16 0 0 1 82 22"
          stroke={colorWithAlpha(ringColor, 0.32)}
          strokeWidth={1}
          strokeLinecap="round"
          fill="none"
        />

        {/* Dash accents on the lower outer edges */}
        <Path
          d="M 28 36 A 16 16 0 0 0 42 45"
          stroke={colorWithAlpha(ringColor, 0.45)}
          strokeWidth={1.25}
          strokeDasharray="2 3"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 84 36 A 16 16 0 0 1 70 45"
          stroke={colorWithAlpha(ringColor, 0.45)}
          strokeWidth={1.25}
          strokeDasharray="2 3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Heart — ring-color outline for contrast, accent fill, no chip behind */}
        <Path
          d="M56 36.2
             C56 36.2 45.5 29.2 45.5 23.6
             C45.5 20.4 47.9 18.2 50.8 18.2
             C52.6 18.2 54.3 19.1 56 20.8
             C57.7 19.1 59.4 18.2 61.2 18.2
             C64.1 18.2 66.5 20.4 66.5 23.6
             C66.5 29.2 56 36.2 56 36.2 Z"
          fill={accent}
          stroke={ringColor}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: WIDTH,
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
