import { useEffect, useId } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';

/** Outer flame and inner flame, in a 120 × 140 box. */
const OUTER =
  'M60 4 C66 26 90 40 99 66 C108 96 92 134 60 135 C28 134 11 104 19 76 C23 61 31 52 38 46 C37 60 42 70 50 73 C45 50 49 27 60 4 Z';
const INNER =
  'M62 56 C70 70 84 81 84 101 C84 118 74 128 60 128 C46 128 36 118 36 104 C36 92 42 84 50 78 C50 88 54 94 60 96 C56 82 56 69 62 56 Z';
const INK = '#000000';
const SINE = Easing.inOut(Easing.sin);

type Props = {
  /** Width; height follows the flame's 120:140 shape. */
  size: number;
  /** The little face (eyes with glints, smile, cheeks). */
  face?: boolean;
  /** Sway, flicker and blink, forever. */
  animated?: boolean;
  /** Spring up from a grey ember on mount (the celebration). */
  ignite?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The streak flame as a sticker character, in the onboarding art style: a
 * thick ink outline, softly shaded orange outer flame with a highlight, a
 * yellow inner flame, and (optionally) a face. The layers move on their own
 * rhythms: the outer flame sways, the inner one flickers, the face blinks.
 */
export function StickerFlame({ size, face = false, animated = false, ignite = false, style }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const reduceMotion = useReducedMotion();
  const w = size;
  const h = (size * 140) / 120;
  // Outlines read the same at any size: thicker (in box units) when small.
  const small = size < 48;
  const outerStroke = small ? 9 : 4;
  const innerStroke = small ? 7 : 3.5;
  const live = animated && !reduceMotion;

  const sway = useSharedValue(0);
  const flick = useSharedValue(0);
  const blink = useSharedValue(1);
  const grow = useSharedValue(ignite && !reduceMotion ? 0.18 : 1);
  const squash = useSharedValue(1);
  const grey = useSharedValue(ignite && !reduceMotion ? 1 : 0);

  useEffect(() => {
    if (ignite && !reduceMotion) {
      // A grey ember springs up into the full flame: tall, squash, settle.
      grow.value = withDelay(
        120,
        withSequence(
          withTiming(1.14, { duration: 370, easing: Easing.out(Easing.cubic) }),
          withTiming(0.94, { duration: 165 }),
          withTiming(1.03, { duration: 140 }),
          withTiming(1, { duration: 150 }),
        ),
      );
      squash.value = withDelay(
        120,
        withSequence(
          withTiming(1.06, { duration: 370 }),
          withTiming(0.96, { duration: 165 }),
          withTiming(1.02, { duration: 140 }),
          withTiming(1, { duration: 150 }),
        ),
      );
      grey.value = withDelay(120, withTiming(0, { duration: 520, easing: Easing.out(Easing.quad) }));
    }
    if (live) {
      const start = ignite ? 900 : 0;
      sway.value = withDelay(start, withRepeat(withTiming(1, { duration: 2200, easing: SINE }), -1, false));
      flick.value = withDelay(start + 100, withRepeat(withTiming(1, { duration: 1300, easing: SINE }), -1, false));
      if (face) {
        blink.value = withDelay(
          start + 1500,
          withRepeat(
            withSequence(
              withTiming(1, { duration: 3680 }),
              withTiming(0.1, { duration: 120 }),
              withTiming(1, { duration: 200 }),
            ),
            -1,
            false,
          ),
        );
      }
    }
    // Shared values are stable; this runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: grow.value / squash.value }, { scaleY: grow.value * squash.value }],
  }));
  // One full cycle of 0 → 1 maps to a gentle side-to-side lean and stretch.
  const outerStyle = useAnimatedStyle(() => {
    const t = sway.value * Math.PI * 2;
    return { transform: [{ skewX: `${Math.sin(t) * 3}deg` }, { scaleY: 1 + Math.sin(t * 2) * 0.03 }] };
  });
  const innerStyle = useAnimatedStyle(() => {
    const t = flick.value * Math.PI * 2;
    return { transform: [{ scaleX: 1 - Math.sin(t) * 0.045 }, { scaleY: 1 + Math.sin(t) * 0.06 }] };
  });
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const greyStyle = useAnimatedStyle(() => ({ opacity: grey.value }));

  const box = { width: w, height: h };

  return (
    <Animated.View style={[box, styles.origin, wrapStyle, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, styles.origin, outerStyle]}>
        <Svg width={w} height={h} viewBox="0 0 120 140">
          <Defs>
            <LinearGradient id={`o${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFB23E" />
              <Stop offset="0.45" stopColor="#FF7A1A" />
              <Stop offset="1" stopColor="#F0501A" />
            </LinearGradient>
          </Defs>
          <Path d={OUTER} fill={`url(#o${uid})`} stroke={INK} strokeWidth={outerStroke} strokeLinejoin="round" />
          {/* Light catching the left edge. */}
          {small ? null : (
            <Path d="M28.5 108 C25 98 25.5 88 29.5 80" fill="none" stroke="#FFD49A" strokeWidth={4.5} strokeLinecap="round" />
          )}
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.innerOrigin, innerStyle]}>
        <Svg width={w} height={h} viewBox="0 0 120 140">
          <Defs>
            <LinearGradient id={`i${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFF0A8" />
              <Stop offset="1" stopColor="#FFC83D" />
            </LinearGradient>
          </Defs>
          <Path d={INNER} fill={`url(#i${uid})`} stroke={INK} strokeWidth={innerStroke} strokeLinejoin="round" />
          {face ? (
            <>
              <Path d="M53.5 111 Q60 117 66.5 111" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
              <Ellipse cx={45.5} cy={110} rx={3.8} ry={2.3} fill="#FF8FA3" />
              <Ellipse cx={74.5} cy={110} rx={3.8} ry={2.3} fill="#FF8FA3" />
            </>
          ) : null}
        </Svg>
        {face ? (
          <Animated.View style={[StyleSheet.absoluteFill, styles.eyesOrigin, eyesStyle]}>
            <Svg width={w} height={h} viewBox="0 0 120 140">
              <Ellipse cx={52.5} cy={101} rx={3.6} ry={4.6} fill={INK} />
              <Ellipse cx={67.5} cy={101} rx={3.6} ry={4.6} fill={INK} />
              <Circle cx={53.8} cy={99.2} r={1.25} fill="#FFFFFF" />
              <Circle cx={68.8} cy={99.2} r={1.25} fill="#FFFFFF" />
            </Svg>
          </Animated.View>
        ) : null}
      </Animated.View>

      {/* The grey ember it starts as, fading out as the colour floods in. */}
      {ignite ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, greyStyle]}>
          <Svg width={w} height={h} viewBox="0 0 120 140">
            <Path d={OUTER} fill="#B9B4AF" stroke={INK} strokeWidth={outerStroke} strokeLinejoin="round" />
            <Path d={INNER} fill="#DCD8D3" stroke={INK} strokeWidth={innerStroke} strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Flames grow and lean from their base, not their middle.
  origin: { transformOrigin: '50% 96%' },
  innerOrigin: { transformOrigin: '50% 91%' },
  eyesOrigin: { transformOrigin: '50% 72%' },
});

/** Keeps a StickerFlame's footprint for layout (width × height). */
export function stickerFlameHeight(size: number) {
  return (size * 140) / 120;
}
