import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const WIDTH = 112;
const HEIGHT = 58;

/**
 * Interlocking rings between the two avatars — soft dashed bridges,
 * with a stroked heart sitting in the overlap (no chip behind it).
 */
export function ProfileCoupleLink({ accent }: { accent: string }) {
  return (
    <View style={styles.wrap} accessibilityElementsHidden>
      <Svg width={WIDTH} height={HEIGHT}>
        <Defs>
          <LinearGradient id="ringFade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.3" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.3" />
          </LinearGradient>
        </Defs>

        {/* Soft dashed bridges from each avatar into the rings */}
        <Path
          d="M 2 29 C 14 29, 22 29, 30 29"
          stroke="url(#ringFade)"
          strokeWidth={1.5}
          strokeDasharray="2.5 3.5"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 110 29 C 98 29, 90 29, 82 29"
          stroke="url(#ringFade)"
          strokeWidth={1.5}
          strokeDasharray="2.5 3.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Left ring */}
        <Circle cx={42} cy={29} r={16} stroke="rgba(255,255,255,0.9)" strokeWidth={2.1} fill="none" />
        {/* Right ring */}
        <Circle cx={70} cy={29} r={16} stroke="rgba(255,255,255,0.9)" strokeWidth={2.1} fill="none" />

        {/* Soft highlight arcs */}
        <Path
          d="M 30 22 A 16 16 0 0 1 54 22"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth={1}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 58 22 A 16 16 0 0 1 82 22"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth={1}
          strokeLinecap="round"
          fill="none"
        />

        {/* Dash accents on the lower outer edges */}
        <Path
          d="M 28 36 A 16 16 0 0 0 42 45"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={1.25}
          strokeDasharray="2 3"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 84 36 A 16 16 0 0 1 70 45"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={1.25}
          strokeDasharray="2 3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Heart — white outline for contrast, accent fill, no chip behind */}
        <Path
          d="M56 36.2
             C56 36.2 45.5 29.2 45.5 23.6
             C45.5 20.4 47.9 18.2 50.8 18.2
             C52.6 18.2 54.3 19.1 56 20.8
             C57.7 19.1 59.4 18.2 61.2 18.2
             C64.1 18.2 66.5 20.4 66.5 23.6
             C66.5 29.2 56 36.2 56 36.2 Z"
          fill={accent}
          stroke="#FFFFFF"
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
