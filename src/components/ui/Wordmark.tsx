import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { LogoMark } from '@/components/ui/Logo';
import { useTheme } from '@/hooks/useTheme';

type WordmarkProps = {
  /** Font size the whole lockup is built around; the mark scales from it. */
  size?: number;
  /** Defaults to the current theme's text color. */
  color?: string;
  /** Plays the mark's rise-in + slow heartbeat. Off by default (most places
   * it's one logo among other content); the launch screen turns it on. */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** The Moments logo lockup: the official mark (E8) beside the name. */
export function Wordmark({ size = 32, color, animated = false, style }: WordmarkProps) {
  const { colors } = useTheme();
  const textColor = color ?? colors.text;
  const markSize = Math.round(size * 1.25);

  const enter = useSharedValue(animated ? 0 : 1);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!animated) return;
    enter.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
    pulse.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1.06, { duration: 520, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 520, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    // enter/pulse are stable shared-value refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated]);

  // The mark rises a little as it appears, then gently beats.
  const markStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * size * 0.3 }, { scale: (0.7 + 0.3 * enter.value) * pulse.value }],
  }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * -size * 0.2 }],
  }));

  return (
    <View style={[styles.row, { gap: size * 0.18 }, style]} accessible accessibilityRole="image" accessibilityLabel="Moments">
      <Animated.View style={markStyle}>
        <LogoMark size={markSize} />
      </Animated.View>
      <Animated.Text style={[styles.text, { color: textColor, fontSize: size, letterSpacing: size * -0.03 }, nameStyle]}>
        Moments
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  // Heavy sans, matching the name everywhere else it appears.
  text: { fontWeight: '800' },
});

