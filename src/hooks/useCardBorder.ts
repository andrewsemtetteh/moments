import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * The outline every Home card shares (mood, question, plans, invite…), so they
 * all read as cards on every theme: a hairline normally, a bold 2px line on
 * the bold-outline themes.
 */
export function useCardBorder() {
  const { colors } = useTheme();
  return { borderColor: colors.border, borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth };
}
