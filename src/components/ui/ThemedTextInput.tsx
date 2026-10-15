import type { Ref } from 'react';
import { TextInput as RNTextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/** The instance type, so \`useRef<TextInput>\` keeps working where this replaces react-native's. */
export type TextInput = RNTextInput;

/**
 * react-native's TextInput with the theme's keyboard (dark on dark themes), cursor and placeholder
 * colours. Anything passed explicitly still wins.
 */
export function TextInput({ ref, ...props }: TextInputProps & { ref?: Ref<RNTextInput> }) {
  const { colors } = useTheme();
  return (
    <RNTextInput
      keyboardAppearance={colors.isDark ? 'dark' : 'light'}
      selectionColor={colors.accent}
      cursorColor={colors.accent}
      placeholderTextColor={colors.textTertiary}
      {...props}
      ref={ref}
    />
  );
}
