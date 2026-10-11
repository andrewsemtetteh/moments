import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';

const DOT = 7;

function Dot({ index }: { index: number }) {
  const { colors } = useTheme();
  const lift = useSharedValue(0);

  useEffect(() => {
    // Staggered wave — each dot rises and falls a beat after the one before it.
    lift.value = withDelay(
      index * 160,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 260 }),
        ),
        -1,
      ),
    );
  }, [index, lift]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + lift.value * 0.6,
    transform: [{ translateY: -lift.value * 3 }],
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: colors.textSecondary }, style]} />;
}

/** Partner-is-typing bubble: three dots in a gentle staggered wave. */
export function TypingIndicator() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.pill, { backgroundColor: colors.chatBubblePartner, borderColor: colors.border }]}
      accessibilityLabel="Partner is typing">
      <Dot index={0} />
      <Dot index={1} />
      <Dot index={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
});
