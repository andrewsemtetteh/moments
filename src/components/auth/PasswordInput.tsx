import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputProps, type ViewStyle } from 'react-native';

import { AuthTextField } from '@/components/auth/AuthTextField';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

type Props = Omit<TextInputProps, 'secureTextEntry' | 'placeholder'> & {
  label?: string;
  /** @deprecated Use `label` instead. */
  placeholder?: string;
  containerStyle?: ViewStyle;
  labelBackgroundColor?: string;
  /** When set, shows a hint below the field (e.g. minimum length). */
  minLength?: number;
};

export function PasswordInput({
  label,
  placeholder,
  containerStyle,
  labelBackgroundColor,
  minLength,
  style,
  value = '',
  ...rest
}: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const fieldLabel = label ?? placeholder ?? 'Password';
  const length = typeof value === 'string' ? value.length : 0;
  const showHint = minLength != null && minLength > 0;
  const hintMet = length >= (minLength ?? 0);
  const hintActive = length > 0;

  return (
    <View style={containerStyle}>
      <AuthTextField
        {...rest}
        value={value}
        label={fieldLabel}
        labelBackgroundColor={labelBackgroundColor}
        style={style}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        rightAdornment={
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            style={styles.toggle}>
            <Icon name={visible ? 'eyeOff' : 'eye'} size={22} color={colors.textSecondary} />
          </Pressable>
        }
      />
      {showHint && (
        <Text
          style={[
            styles.hint,
            {
              color: hintMet
                ? colors.success
                : hintActive
                  ? colors.warning
                  : colors.textTertiary,
            },
          ]}>
          {hintMet ? `At least ${minLength} characters` : `Use at least ${minLength} characters`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    padding: 4,
    marginLeft: 4,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
    lineHeight: 16,
  },
});
