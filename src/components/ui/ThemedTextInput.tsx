import type { Ref } from 'react';
import { TextInput as RNTextInput, type TextInputProps } from 'react-native';

import { notifyInputFocused } from '@/components/ui/KeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';

/** The instance type, so \`useRef<TextInput>\` keeps working where this replaces react-native's. */
export type TextInput = RNTextInput;

/**
 * react-native's TextInput with the theme's keyboard (dark on dark themes), cursor and placeholder
 * colours. Anything passed explicitly still wins.
 */
// A value and its type share the name on purpose, like react-native's own TextInput.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export function TextInput({ ref, ...props }: TextInputProps & { ref?: Ref<RNTextInput> }) {
  const { colors } = useTheme();
  return (
    <RNTextInput
      keyboardAppearance={colors.isDark ? 'dark' : 'light'}
      selectionColor={colors.accent}
      cursorColor={colors.accent}
      placeholderTextColor={colors.textTertiary}
      {...props}
      onFocus={(e) => {
        // Lets a form scroll this field above the keyboard (KeyboardAwareScrollView).
        notifyInputFocused();
        props.onFocus?.(e);
      }}
      ref={ref}
    />
  );
}
