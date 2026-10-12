import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export type StreakFlameTone = 'active' | 'risk' | 'idle';
/**
 * - `flicker`: a live flame, the tip sways and the core breathes (streak alive)
 * - `pulse`: a slow heartbeat (streak ends tonight)
 * - `pop`: springs in once on mount, then flickers (Streak page hero)
 */
export type StreakFlameEffect = 'none' | 'flicker' | 'pulse' | 'pop';

const OUTER =
  'M12 1.8c.9 3.6 6.8 6.3 6.8 12.3A6.8 6.8 0 0 1 12 21a6.8 6.8 0 0 1-6.8-6.9c0-2.8 1.3-4.8 2.9-6.1.1 2.2 1.1 3.6 2.4 4.1C10.3 9 10 5 12 1.8z';
const CORE =
  'M12 11.2c.4 1.9 3.3 3.1 3.3 5.9A3.3 3.3 0 0 1 12 20.4a3.3 3.3 0 0 1-3.3-3.3c0-1.5.8-2.6 1.7-3.2.1 1 .6 1.7 1.2 1.9-.1-1.6-.2-3.2.4-4.6z';

/** Outer flame: tip → middle → base. Core: tip → base. */
const TONES: Record<StreakFlameTone, { outer: [string, string, string]; core: [string, string] }> = {
  // Real fire: gold tip, orange body, deep red base, a yellow-white heart.
  active: { outer: ['#FFC93C', '#FF7A00', '#E0300B'], core: ['#FFFBEA', '#FFD84D'] },
  risk: { outer: ['#FF8A8A', '#F0384A', '#B3122B'], core: ['#FFF1F2', '#FFB3BC'] },
  idle: { outer: ['#C9C4C0', '#A9A4A0', '#8E8A87'], core: ['#F1EEEB', '#D6D1CD'] },
};

const SINE = Easing.inOut(Easing.sin);

function FlameLayer({ d, id, stops, size }: { d: string; id: string; stops: string[]; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {stops.map((c, i) => (
            <Stop key={i} offset={stops.length === 1 ? 0 : i / (stops.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Path d={d} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * The streak's flame, used everywhere a streak shows (intro card, week strip,
 * Streak page, calendar) so it always looks and moves the same. Motion is
 * subtle and skipped entirely when the system's Reduce Motion is on.
 */
export function StreakFlame({
  size = 20,
  tone = 'active',
  effect = 'none',
}: {
  size?: number;
  tone?: StreakFlameTone;
  effect?: StreakFlameEffect;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const t = TONES[tone];
  const reduceMotion = useReducedMotion();
  const mode = reduceMotion || tone === 'idle' ? 'none' : effect;

  const sway = useSharedValue(0); // -1…1, tip leans left/right
  const lift = useSharedValue(1); // flame height
  const glow = useSharedValue(1); // core size
  const beat = useSharedValue(1); // whole-flame scale (pulse / pop)

  useEffect(() => {
    sway.value = 0;
    lift.value = 1;
    glow.value = 1;
    beat.value = mode === 'pop' ? 0.4 : 1;
    if (mode === 'none') return;

    if (mode === 'pulse') {
      beat.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 260, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 320, easing: Easing.in(Easing.quad) }),
          withTiming(1, { duration: 800 }),
        ),
        -1,
      );
      return () => cancelAnimation(beat);
    }

    if (mode === 'pop') {
      beat.value = withSpring(1, { damping: 9, stiffness: 180, mass: 0.7 });
    }
    // Uneven periods so the three motions never line up into a visible loop.
    const start = mode === 'pop' ? 450 : 0;
    sway.value = withDelay(
      start,
      withRepeat(
        withSequence(withTiming(1, { duration: 1100, easing: SINE }), withTiming(-1, { duration: 1300, easing: SINE })),
        -1,
        true,
      ),
    );
    lift.value = withDelay(
      start,
      withRepeat(
        withSequence(withTiming(1.06, { duration: 700, easing: SINE }), withTiming(0.97, { duration: 900, easing: SINE })),
        -1,
        true,
      ),
    );
    glow.value = withDelay(
      start,
      withRepeat(
        withSequence(withTiming(1.1, { duration: 500, easing: SINE }), withTiming(0.92, { duration: 650, easing: SINE })),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(sway);
      cancelAnimation(lift);
      cancelAnimation(glow);
      cancelAnimation(beat);
    };
  }, [mode, sway, lift, glow, beat]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: beat.value }, { skewX: `${sway.value * 3}deg` }, { scaleY: lift.value }],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: beat.value }, { skewX: `${sway.value * -2}deg` }, { scale: glow.value }],
  }));

  if (mode === 'none') {
    return (
      <View style={{ width: size, height: size }}>
        <FlameLayer d={OUTER} id={`o${id}`} stops={t.outer} size={size} />
        <View style={StyleSheet.absoluteFill}>
          <FlameLayer d={CORE} id={`c${id}`} stops={t.core} size={size} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.base, outerStyle]}>
        <FlameLayer d={OUTER} id={`o${id}`} stops={t.outer} size={size} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.base, coreStyle]}>
        <FlameLayer d={CORE} id={`c${id}`} stops={t.core} size={size} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Flames grow and sway from their base, not their middle.
  base: { transformOrigin: 'bottom' },
});
