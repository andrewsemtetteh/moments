import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

const SIZE = 168;
const ORANGE = '#FF8A00';
const AMBER = '#FFB020';
const YELLOW = '#FFCC33';
const COUNT_FILL = '#FFFFFF';
const COUNT_BORDER = '#1A1008';
const SPRING_PEAK = { damping: 8, stiffness: 170, mass: 0.8 };
const SPRING_SETTLE = { damping: 13, stiffness: 190 };

/** Offsets for a solid outline around the streak number. */
const OUTLINE_OFFSETS: Array<[number, number]> = [
  [-3, 0],
  [3, 0],
  [0, -3],
  [0, 3],
  [-2.5, -2.5],
  [2.5, -2.5],
  [-2.5, 2.5],
  [2.5, 2.5],
  [-3, -1.5],
  [3, -1.5],
  [-3, 1.5],
  [3, 1.5],
  [-1.5, -3],
  [1.5, -3],
  [-1.5, 3],
  [1.5, 3],
];

type Props = {
  count: number;
  fromCount: number;
  onSettled?: () => void;
};

/**
 * Grey → color at final size, then the flame tip overshoots upward past the
 * settled height (base stays planted) and springs back. Counter ticks with a
 * high-contrast bordered digit.
 */
export function SparkStreakFlame({ count, fromCount, onSettled }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || theme === 'black' || theme === 'green';
  const grey = isDark ? '#5A5A62' : '#C5C5C8';

  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const [shown, setShown] = useState(fromCount);

  useEffect(() => {
    setShown(fromCount);
    progress.value = 0;
    scale.value = 1;

    const tickStart = Date.now();
    const duration = 420;
    const delay = 160;
    const timer = setInterval(() => {
      const elapsed = Date.now() - tickStart - delay;
      if (elapsed < 0) return;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(fromCount + (count - fromCount) * eased));
      if (t >= 1) clearInterval(timer);
    }, 32);

    progress.value = withDelay(
      50,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );

    // Fill at the settled base size, then tip overshoots past it and lands — same motion as before,
    // but anchored so the base stays planted and only the top rises past the final level.
    scale.value = withDelay(
      480,
      withSequence(withSpring(1.28, SPRING_PEAK), withSpring(1, SPRING_SETTLE)),
    );

    const settle = setTimeout(() => {
      setShown(count);
      onSettled?.();
    }, 980);

    return () => {
      clearInterval(timer);
      clearTimeout(settle);
      cancelAnimation(progress);
      cancelAnimation(scale);
    };
  }, [count, fromCount, onSettled, progress, scale]);

  // Scale from the bottom so the tip overshoots upward; the base stays put.
  const stackStyle = useAnimatedStyle(() => {
    const s = scale.value;
    return {
      transform: [{ translateY: ((1 - s) * SIZE) / 2 }, { scale: s }],
    };
  });

  const greyOpacity = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));

  const colorOpacity = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.stack, stackStyle]}>
        <View style={styles.flameBox}>
          <Animated.View style={[styles.layer, greyOpacity]}>
            <Icon name="fire" size={SIZE} color={grey} filled strokeWidth={1.2} />
          </Animated.View>
          <Animated.View style={[styles.layer, colorOpacity]}>
            <Icon name="fire" size={SIZE} color={ORANGE} filled strokeWidth={1.4} />
            <View style={styles.mid}>
              <Icon name="fire" size={SIZE * 0.72} color={AMBER} filled strokeWidth={1.2} />
            </View>
            <View style={styles.inner}>
              <Icon name="fire" size={SIZE * 0.42} color={YELLOW} filled strokeWidth={1.1} />
            </View>
          </Animated.View>
        </View>
        <View style={styles.countWrap} pointerEvents="none">
          {OUTLINE_OFFSETS.map(([dx, dy]) => (
            <Text
              key={`${dx},${dy}`}
              style={[
                styles.count,
                styles.countOutline,
                {
                  color: COUNT_BORDER,
                  transform: [{ translateX: dx }, { translateY: 14 + dy }],
                },
              ]}>
              {shown}
            </Text>
          ))}
          <Text
            style={[
              styles.count,
              {
                color: COUNT_FILL,
                textShadowColor: COUNT_BORDER,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 1.5,
                transform: [{ translateY: 14 }],
              },
            ]}>
            {shown}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameBox: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  inner: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  countWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontSize: 68,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 68,
    textAlign: 'center',
    includeFontPadding: false,
  },
  countOutline: {
    position: 'absolute',
  },
});
