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
