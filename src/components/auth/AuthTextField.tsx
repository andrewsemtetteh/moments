import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';

const AnimatedText = Animated.createAnimatedComponent(Text);

type Props = Omit<TextInputProps, 'placeholder'> & {
  label: string;
  containerStyle?: ViewStyle;
  rightAdornment?: ReactNode;
  /** Background behind the floated label notch (defaults to page background). */
  labelBackgroundColor?: string;
};

export function AuthTextField({
  label,
  value = '',
  onChangeText,
  containerStyle,
  rightAdornment,
  labelBackgroundColor,
  style,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;
  const notchBg = labelBackgroundColor ?? colors.background;

  const focusProgress = useSharedValue(0);
  const labelProgress = useSharedValue(floated ? 1 : 0);

  useEffect(() => {
    focusProgress.value = withTiming(focused ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [focused, focusProgress]);

  useEffect(() => {
    labelProgress.value = withTiming(floated ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [floated, labelProgress]);

  const containerAnimStyle = useAnimatedStyle(() => ({
    borderWidth: 1 + focusProgress.value * 0.5,
    borderColor: interpolateColor(focusProgress.value, [0, 1], [colors.border, colors.accent]),
  }));

  const labelAnimStyle = useAnimatedStyle(() => {
    const accent = colors.accent;
    const secondary = colors.textSecondary;
    const tertiary = colors.textTertiary;

    return {
      top: interpolate(labelProgress.value, [0, 1], [14, -9]),
      fontSize: interpolate(labelProgress.value, [0, 1], [15, 11]),
      color:
        labelProgress.value < 0.5
          ? tertiary
          : interpolateColor(focusProgress.value, [0, 1], [secondary, accent]),
      backgroundColor: labelProgress.value > 0.05 ? notchBg : 'transparent',
    };
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.surface },
        containerAnimStyle,
        containerStyle,
      ]}>
      <AnimatedText pointerEvents="none" style={[styles.label, labelAnimStyle]}>
        {label}
      </AnimatedText>

      <View style={styles.inputRow}>
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
          style={[styles.input, { color: colors.text }, style]}
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
});
