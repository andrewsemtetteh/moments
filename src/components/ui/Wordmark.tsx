import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

/** The "o" in "moments": two hearts in the app's own established couple-
 * identity colors (the same rose/blue used for "me"/"partner" throughout
 * moments, story rings, and shared-location pins) — not decoration for its
 * own sake, but the app's actual visual language for "the two of you,"
 * reused as the wordmark's one distinctive mark. */
const ME_COLOR = '#e85d75';
const PARTNER_COLOR = '#5b8def';

type WordmarkProps = {
  /** Font size the whole lockup is built around — everything else scales from it. */
  size?: number;
  /** Defaults to the current theme's text color. */
  color?: string;
  /** Plays the hearts' settle-together entrance + slow heartbeat. Off by
   * default (most places this appears, it's one logo among other content,
   * not the one thing on screen) — the splash screen turns it on. */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Wordmark({ size = 32, color, animated = false, style }: WordmarkProps) {
  const { colors } = useTheme();
  const textColor = color ?? colors.text;

  const heartUnit = Math.round(size * 0.58);
  const heartSlot = Math.round(size * 0.86);

  const comeTogether = useSharedValue(animated ? 0 : 1);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!animated) return;
    comeTogether.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
    pulse.value = withDelay(
      680,
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 480, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 480, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    // comeTogether/pulse are stable shared-value refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated]);

  const meStyle = useAnimatedStyle(() => ({
    opacity: comeTogether.value,
    transform: [
      { translateX: interpolate(comeTogether.value, [0, 1], [-10, 0]) },
      { translateY: interpolate(comeTogether.value, [0, 1], [-8, 0]) },
      { scale: interpolate(comeTogether.value, [0, 1], [0.5, 1]) * pulse.value },
    ],
  }));
  const partnerStyle = useAnimatedStyle(() => ({
    opacity: comeTogether.value,
    transform: [
      { translateX: interpolate(comeTogether.value, [0, 1], [10, 0]) },
      { translateY: interpolate(comeTogether.value, [0, 1], [8, 0]) },
      { scale: interpolate(comeTogether.value, [0, 1], [0.5, 1]) * pulse.value },
    ],
  }));

  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.text, { color: textColor, fontSize: size, letterSpacing: size * -0.025 }]}>
        m
      </Text>
      <View
        style={{
          width: heartSlot,
          height: heartSlot,
          marginTop: size * 0.14,
          marginHorizontal: 1,
        }}>
        <Animated.View style={[styles.heart, meStyle, { top: 2, left: 0 }]}>
          <Icon name="heart" size={heartUnit} color={ME_COLOR} filled />
        </Animated.View>
        <Animated.View
          style={[
            styles.heart,
            partnerStyle,
            { top: heartSlot - heartUnit - 2, left: heartSlot - heartUnit },
          ]}>
          <Icon name="heart" size={heartUnit} color={PARTNER_COLOR} filled />
        </Animated.View>
      </View>
      <Text style={[styles.text, { color: textColor, fontSize: size, letterSpacing: size * -0.025 }]}>
        ments
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Bold system sans, not a custom display face — matches the app name
  // everywhere else it appears (login, get-started), so the wordmark reads
  // as one consistent brand treatment rather than a one-off splash design.
  text: {
    fontWeight: '800',
  },
  heart: {
    position: 'absolute',
  },
});
