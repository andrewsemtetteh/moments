import { useEffect } from 'react';
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

const SIZE = 112;
const FLAME_OUTER = '#FF8C00';
const FLAME_INNER = '#FFCC00';
const SPRING_IDLE = { damping: 17, stiffness: 130 };

export function MilestoneHeroFlame() {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);

  useEffect(() => {
    rotate.value = withDelay(
      100,
      withRepeat(
        withSequence(
          withSpring(2.5, SPRING_IDLE),
          withSpring(-2.5, SPRING_IDLE),
        ),
        -1,
        true,
      ),
    );

    scaleY.value = withRepeat(
      withSequence(
        withSpring(1.05, SPRING_IDLE),
        withSpring(0.98, SPRING_IDLE),
      ),
      -1,
      true,
    );

    scaleX.value = withRepeat(
      withSequence(
        withSpring(0.97, SPRING_IDLE),
        withSpring(1.02, SPRING_IDLE),
      ),
      -1,
      true,
    );

    translateY.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(translateY);
      cancelAnimation(rotate);
      cancelAnimation(scaleX);
      cancelAnimation(scaleY);
    };
  }, [translateY, rotate, scaleX, scaleY]);

  const motionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
  }));

  return (
    <Animated.View style={[styles.stack, motionStyle]}>
      <Icon name="fire" size={SIZE} color={FLAME_OUTER} filled strokeWidth={1.4} />
      <View style={styles.inner}>
        <Icon name="fire" size={SIZE * 0.52} color={FLAME_INNER} filled strokeWidth={1.2} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  inner: {
    position: 'absolute',
    bottom: 11,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
