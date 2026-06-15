import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  containerStyle?: object;
};

export function PasswordInput({ containerStyle, style, ...rest }: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.surface, borderColor: colors.border },
        containerStyle,
      ]}>
      <TextInput
        {...rest}
        style={[styles.input, { color: colors.text }, style]}
        secureTextEntry={!visible}
        placeholderTextColor={colors.textTertiary}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        style={styles.toggle}>
        <Icon name={visible ? 'eyeOff' : 'eye'} size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingRight: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
  },
  toggle: {
    padding: 4,
  },
});
