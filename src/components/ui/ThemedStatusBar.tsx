import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/hooks/useTheme';

/**
 * The status bar (clock, battery) for a full-screen layer. On iOS a <Modal> is
 * its own screen and doesn't inherit the app's status bar style, so every
 * full-screen modal renders one of these: dark icons on light themes, light on
 * dark ones, or a forced `style` over photos / camera / gradients.
 */
export function ThemedStatusBar({ style }: { style?: 'light' | 'dark' }) {
  const { colors } = useTheme();
  return <StatusBar style={style ?? (colors.isDark ? 'light' : 'dark')} animated />;
}
