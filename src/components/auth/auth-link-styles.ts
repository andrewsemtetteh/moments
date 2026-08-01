import { StyleSheet } from 'react-native';

import type { ThemeColors } from '@/constants/design-system';

/** Muted / emphasis link colors — matches get-started on dark auth screens. */
export function authLinkColors(colors: ThemeColors) {
  if (colors.isDark) {
    return {
      muted: 'rgba(255,255,255,0.72)',
      emphasis: '#FFFFFF',
      legalMuted: 'rgba(255,255,255,0.55)',
      legalLink: 'rgba(255,255,255,0.85)',
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
