import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';

type Props = {
  color: string;
  size?: number;
  animate?: boolean;
  pulse?: boolean;
  /** When set, plays a bouncy burst every N ms instead of looping continuously. */
  periodic?: number;
  /** Layered outer / mid / core flame (card hero). */
  layered?: boolean;
};

const SPRING_POP = { damping: 7, stiffness: 220, mass: 0.72 };
const SPRING_SETTLE = { damping: 14, stiffness: 250 };
const SPRING_IDLE = { damping: 17, stiffness: 130 };
/** Ionicons flame is tall — stretch slightly for the card hero. */
const LAYERED_WIDTH = 1.28;
const LAYERED_WIDTH_COMPACT = 1.12;
/** Real fire streak palette (not theme / status tinted). */
const FIRE_OUTER = '#FF6B00';
const FIRE_MID = '#FF9500';
const FIRE_INNER = '#FFD600';

export function AnimatedStreakFire({
  color,
  size = 22,
  animate = true,
  pulse = false,
  periodic,
  layered = false,
}: Props) {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      cancelAnimation(translateY);
      cancelAnimation(rotate);
      cancelAnimation(scaleX);
      cancelAnimation(scaleY);
      translateY.value = 0;
      rotate.value = 0;
      scaleX.value = 1;
      scaleY.value = 1;
    };

    if (!animate) {
      reset();
      return;
    }

    const playBurst = () => {
      const popY = pulse ? 1.28 : 1.2;
      const pinchX = pulse ? 0.88 : 0.91;
      const hop = pulse ? -7 : -5;

      scaleY.value = withSequence(
        withTiming(pulse ? 0.8 : 0.86, { duration: 80, easing: Easing.in(Easing.quad) }),
        withSpring(popY, SPRING_POP),
        withSpring(1, SPRING_SETTLE),
      );

      scaleX.value = withSequence(
        withTiming(pulse ? 1.14 : 1.1, { duration: 80, easing: Easing.in(Easing.quad) }),
        withSpring(pinchX, SPRING_POP),
        withSpring(1, SPRING_SETTLE),
      );

      translateY.value = withSequence(
        withTiming(hop, { duration: 90, easing: Easing.out(Easing.quad) }),
        withSpring(0, SPRING_SETTLE),
      );

      rotate.value = withSequence(
        withTiming(pulse ? -9 : -6, { duration: 70, easing: Easing.in(Easing.quad) }),
        withSpring(pulse ? 7 : 5, { damping: 6, stiffness: 200 }),
        withSpring(0, SPRING_SETTLE),
      );
    };

    const startIdleLoop = () => {
      rotate.value = withDelay(
        100,
        withRepeat(
          withSequence(
            withSpring(pulse ? 3.5 : 2, SPRING_IDLE),
            withSpring(pulse ? -3.5 : -2, SPRING_IDLE),
          ),
          -1,
          true,
        ),
      );

      scaleY.value = withRepeat(
        withSequence(
          withSpring(pulse ? 1.08 : 1.05, SPRING_IDLE),
          withSpring(pulse ? 0.96 : 0.98, SPRING_IDLE),
        ),
        -1,
        true,
      );

      scaleX.value = withRepeat(
        withSequence(
          withSpring(pulse ? 0.95 : 0.97, SPRING_IDLE),
          withSpring(pulse ? 1.04 : 1.02, SPRING_IDLE),
        ),
        -1,
        true,
      );

      translateY.value = withRepeat(
        withSequence(
          withTiming(pulse ? -3 : -2, { duration: pulse ? 900 : 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: pulse ? 900 : 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    };

    if (periodic) {
      const scheduleBurst = () => {
        burstTimeoutRef.current = setTimeout(() => {
          playBurst();
          scheduleBurst();
        }, periodic);
      };

      scheduleBurst();

      return () => {
        if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
        burstTimeoutRef.current = null;
        reset();
      };
    }

    startIdleLoop();
    return reset;
  }, [animate, periodic, pulse, translateY, rotate, scaleX, scaleY]);

  const widthScale = layered ? (size >= 40 ? LAYERED_WIDTH : LAYERED_WIDTH_COMPACT) : 1;

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scaleX: scaleX.value * widthScale },
      { scaleY: scaleY.value },
    ],
  }));

  const mid = Math.round(size * 0.76);
  const inner = Math.round(size * 0.48);
  const rootW = Math.round(size * widthScale);

  return (
    <View style={[styles.root, { width: rootW, height: size }]}>
      <Animated.View style={[layered ? [styles.layered, { width: rootW, height: size }] : null, iconStyle]}>
        {layered ? (
          <>
            <Icon name="fire" size={size} color={FIRE_OUTER} filled strokeWidth={1.2} />
            <View style={[styles.layer, { bottom: Math.round(size * 0.07) }]}>
              <Icon name="fire" size={mid} color={FIRE_MID} filled strokeWidth={1.1} />
            </View>
            <View style={[styles.layer, { bottom: Math.round(size * 0.12) }]}>
              <Icon name="fire" size={inner} color={FIRE_INNER} filled strokeWidth={1} />
            </View>
          </>
        ) : (
          <Icon name="fire" size={size} color={color} filled strokeWidth={1.6} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
