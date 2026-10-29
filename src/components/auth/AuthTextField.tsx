import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextInputProps, type ViewStyle } from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';
import Animated, {
    Easing,
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import { fieldOutline } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';

const AnimatedText = Animated.createAnimatedComponent(Text);

type Props = Omit<TextInputProps, 'placeholder'> & {
  label: string;
  containerStyle?: ViewStyle;
  rightAdornment?: ReactNode;
  /** Fixed glyph glued to the left of the input, e.g. "@" for a username field. */
  prefix?: string;
  /**
   * The field's own fill — and the floated label's masking patch, which always
   * matches it exactly so the border notch blends in instead of leaving a seam.
   * Defaults to the page background (the field visually disappears into the
   * page except for its border). Override on a sheet/modal whose own backdrop
   * isn't the page background, e.g. `colors.surfaceElevated`.
   */
  fieldBackgroundColor?: string;
  /**
   * 'bold' matches the onboarding name field: a thick ink border, rounded,
   * taller, with bold text. The label still floats up onto the border.
   */
  variant?: 'default' | 'bold';
};

export function AuthTextField({
  label,
  value = '',
  onChangeText,
  containerStyle,
  rightAdornment,
  prefix,
  fieldBackgroundColor,
  style,
  onFocus,
  onBlur,
  variant = 'default',
  ...rest
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;
  const bold = variant === 'bold';
  // The page's own background (auth pages), unless a screen on a card passes its colour.
  const fieldBg = fieldBackgroundColor ?? colors.background;
  // Where the label rests (inside) and floats to (on the border line).
  const restTop = bold ? 19 : 14;
  const floatTop = bold ? -10 : -9;
  const restSize = bold ? 16 : 15;
  const floatSize = bold ? 12 : 11;
  const restColor = colors.textSecondary;
  // Bold: the onboarding fields' 2pt line in the theme's ink, the theme colour while typing.
  const focusColor = colors.accent;
  const borderRest = bold ? fieldOutline(colors).borderColor : colors.border;

  const focusProgress = useSharedValue(0);
  const labelProgress = useSharedValue(floated ? 1 : 0);

  useEffect(() => {
    focusProgress.value = withTiming(focused ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [focused, focusProgress]);

  useEffect(() => {
    labelProgress.value = withTiming(floated ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [floated, labelProgress]);

  const containerAnimStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focusProgress.value, [0, 1], [borderRest, focusColor]),
  }));

  const labelAnimStyle = useAnimatedStyle(() => {
    return {
      top: interpolate(labelProgress.value, [0, 1], [restTop, floatTop]),
      fontSize: interpolate(labelProgress.value, [0, 1], [restSize, floatSize]),
      color:
        labelProgress.value < 0.5
          ? restColor
          : interpolateColor(focusProgress.value, [0, 1], [restColor, focusColor]),
      // Matches the container's own fill exactly (fieldBg, not a guess), so the
      // notch blends in perfectly instead of masking with a mismatched patch —
      // that mismatch, not the masking itself, was what made the border look
      // "spoiled." Without this, the border line visibly cuts through the text.
      backgroundColor: labelProgress.value > 0.05 ? fieldBg : 'transparent',
    };
  });

  return (
    <Animated.View
      style={[
        styles.container,
        bold && styles.containerBold,
        { backgroundColor: fieldBg },
        containerAnimStyle,
        containerStyle,
      ]}>
      <AnimatedText pointerEvents="none" style={[styles.label, bold && styles.labelBold, labelAnimStyle]}>
        {label}
      </AnimatedText>

      <View style={styles.inputRow}>
        {prefix && <Text style={[styles.prefix, { color: colors.textSecondary }]}>{prefix}</Text>}
        <TextInput
          {...rest}
          value={value}
          onChangeText={onChangeText}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, bold && styles.inputBold, { color: colors.text }, style]}
          placeholder=""
          placeholderTextColor={colors.textTertiary}
        />
        {rightAdornment}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    // Fixed at the OAuth buttons' own hairline weight (same `colors.border`
    // token) so a field never reads heavier/darker than the rest of the
    // screen — especially in `paper`'s solid-black border — at rest or
    // focused. Only the color animates on focus, so there's no border-width
    // change nudging the input's content box by a pixel.
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingBottom: 8,
    paddingTop: 8,
    minHeight: 50,
    justifyContent: 'center',
    marginTop: 4,
  },
  label: {
    position: 'absolute',
    left: 10,
    zIndex: 1,
    lineHeight: 15,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  // The onboarding name field's look.
  containerBold: { borderWidth: 2, borderRadius: 16, minHeight: 58, paddingHorizontal: 16 },
  labelBold: { left: 12, fontWeight: '800', lineHeight: 18 },
  inputBold: { fontSize: 18, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
    paddingTop: 6,
  },
  prefix: {
    fontSize: 15,
    fontWeight: '600',
    paddingTop: 6,
  },
});
