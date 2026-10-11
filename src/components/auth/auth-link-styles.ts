import { StyleSheet } from 'react-native';

import { colorWithAlpha } from '@/components/ui/primitives';
import type { ThemeColors } from '@/constants/design-system';

/** Muted / emphasis link colors — matches get-started on dark auth screens. */
export function authLinkColors(colors: ThemeColors) {
  if (colors.isDark) {
    return {
      muted: colorWithAlpha(colors.text, 0.72),
      emphasis: colors.text,
      legalMuted: colorWithAlpha(colors.text, 0.55),
      legalLink: colorWithAlpha(colors.text, 0.85),
    };
  }

  return {
    muted: colors.textSecondary,
    emphasis: colors.text,
    legalMuted: colors.textTertiary,
    legalLink: colors.text,
  };
}

export const authLinkStyles = StyleSheet.create({
  footerRow: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 4,
  },
  footerText: {
    fontSize: 15,
    textAlign: 'center',
  },
  footerLink: {
    fontWeight: '700',
  },
  legalText: {
    fontSize: 13,
    lineHeight: 20,
  },
  legalLink: {
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  inlineLink: {
    fontWeight: '700',
  },
});
