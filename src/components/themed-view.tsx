import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
  /** Soft floating-card shadow, tinted from the theme's `shadow` token. */
  elevated?: boolean;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  type,
  elevated,
  ...otherProps
}: ThemedViewProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        { backgroundColor: theme[type ?? 'background'] },
        elevated && [styles.elevated, { shadowColor: theme.shadow }],
        style,
      ]}
      {...otherProps}
    />
  );
}

const styles = StyleSheet.create({
  elevated: {
    borderRadius: Radius.lg,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 4,
  },
});
