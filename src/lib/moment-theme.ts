import type { ThemeColors } from '@/constants/design-system';

/** Shared chrome tokens for moments modals — maps app theme onto story/history/camera UI. */
export function momentChrome(colors: ThemeColors) {
  return {
    background: colors.background,
    elevated: colors.backgroundElevated,
    surface: colors.surfaceElevated,
    surfaceSoft: colors.surface,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textTertiary: colors.textTertiary,
    accent: colors.accent,
    onAccent: colors.onAccent,
    accentSoft: colors.accentSoft,
    border: colors.border,
    error: colors.error,
    /** Icon/text on top of photos/video letterbox */
    onMedia: colors.isDark ? '#FFFFFF' : colors.text,
    mediaBackdrop: colors.isDark ? '#111111' : colors.surface,
    placeholder: colors.surface,
  };
}

export type MomentChrome = ReturnType<typeof momentChrome>;

/**
 * The opened-moment viewer is always dark and immersive, like Photos,
 * Instagram or Locket, whatever the app theme: the photo is what you look at.
 * Only the accent follows your theme.
 */
export function viewerChrome(colors: ThemeColors): MomentChrome {
  return {
    background: '#0B0B10',
    elevated: '#17171F',
    surface: '#202029',
    surfaceSoft: 'rgba(255,255,255,0.12)',
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.74)',
    textTertiary: 'rgba(255,255,255,0.5)',
    accent: colors.accent,
    onAccent: colors.onAccent,
    accentSoft: 'rgba(255,255,255,0.14)',
    border: 'rgba(255,255,255,0.16)',
    error: '#FF6B6B',
    onMedia: '#FFFFFF',
    mediaBackdrop: '#000000',
    placeholder: '#202029',
  };
}
