import type { ThemeColors } from '@/constants/design-system';

/**
 * Premium streak palette — warm flame for active, urgent amber for at-risk,
 * muted rose for lost. Soft fills stay readable on light and dark themes.
 */
export const STREAK_COLORS = {
  /** Active / secured day */
  active: '#FF7A1A',
  activeBright: '#FF8F3D',
  activeSoftLight: 'rgba(255, 122, 26, 0.14)',
  activeSoftDark: 'rgba(255, 143, 61, 0.22)',
  activeFillLight: 'rgba(255, 122, 26, 0.18)',
  activeFillDark: 'rgba(255, 122, 26, 0.28)',
  onActive: '#FFFFFF',

  /** At risk — urgent, not neon */
  atRisk: '#E85D04',
  atRiskDeep: '#C2410C',
  atRiskSoftLight: 'rgba(232, 93, 4, 0.12)',
  atRiskSoftDark: 'rgba(232, 93, 4, 0.22)',
  onAtRisk: '#FFFFFF',

  /** Lost / missed */
  lost: '#A85A5A',
  lostDeep: '#8B4545',
  lostSoftLight: 'rgba(168, 90, 90, 0.14)',
  lostSoftDark: 'rgba(168, 90, 90, 0.24)',
  onLost: '#FFFFFF',

  /** Today still open (not yet secured) */
  pending: '#E8A317',
  pendingBright: '#D4920F',
  pendingSoftLight: 'rgba(232, 163, 23, 0.14)',
  pendingSoftDark: 'rgba(232, 163, 23, 0.22)',
  onPending: '#1A1A1A',

  // Back-compat aliases used elsewhere
  success: '#FF7A1A',
  successBright: '#FF8F3D',
  successSoft: 'rgba(255, 122, 26, 0.18)',
  successFill: 'rgba(255, 122, 26, 0.22)',
  pendingSoft: 'rgba(232, 163, 23, 0.18)',
  atRiskSoft: 'rgba(232, 93, 4, 0.16)',
  onLight: '#FFFFFF',
  streak: '#E8A317',
  streakBright: '#D4920F',
  streakSoft: 'rgba(232, 163, 23, 0.16)',
  onStreak: '#1A1A1A',
  onSuccess: '#FFFFFF',
  flame: '#FF7A1A',
  flameSoft: 'rgba(255, 122, 26, 0.16)',
  onFlame: '#FFFFFF',
} as const;

export type StreakVisualTone = 'idle' | 'active' | 'secured' | 'risk' | 'lost';

export function streakToneFromStatus(status: {
  current_streak: number;
  at_risk: boolean;
  both_active_today: boolean;
}): StreakVisualTone {
  if (status.current_streak <= 0) return 'idle';
  if (status.at_risk) return 'risk';
  if (status.both_active_today) return 'secured';
  return 'active';
}

/** Theme-aware fills for the large flame well and accents. */
export function streakWellColors(tone: StreakVisualTone, colors: ThemeColors) {
  const dark = colors.isDark;
  switch (tone) {
    case 'risk':
      return {
        well: dark ? STREAK_COLORS.atRiskSoftDark : STREAK_COLORS.atRiskSoftLight,
        fire: STREAK_COLORS.atRisk,
        label: STREAK_COLORS.atRisk,
        bannerBg: dark ? STREAK_COLORS.atRiskSoftDark : STREAK_COLORS.atRiskSoftLight,
        bannerText: dark ? STREAK_COLORS.activeBright : STREAK_COLORS.atRiskDeep,
      };
    case 'secured':
    case 'active':
      return {
        well: dark ? STREAK_COLORS.activeSoftDark : STREAK_COLORS.activeSoftLight,
        fire: STREAK_COLORS.activeBright,
        label: STREAK_COLORS.active,
        bannerBg: 'transparent',
        bannerText: colors.textSecondary,
      };
    case 'lost':
      return {
        well: dark ? STREAK_COLORS.lostSoftDark : STREAK_COLORS.lostSoftLight,
        fire: STREAK_COLORS.lost,
        label: STREAK_COLORS.lostDeep,
        bannerBg: dark ? STREAK_COLORS.lostSoftDark : STREAK_COLORS.lostSoftLight,
        bannerText: STREAK_COLORS.lostDeep,
      };
    default:
      return {
        well: colors.surfaceElevated,
        fire: colors.textTertiary,
        label: colors.textSecondary,
        bannerBg: 'transparent',
        bannerText: colors.textSecondary,
      };
  }
}

export function streakFireColor(
  active: boolean,
  atRisk: boolean,
  inactive = '#8E8E93',
  successful = false,
): string {
  if (atRisk) return STREAK_COLORS.atRisk;
  if (successful) return STREAK_COLORS.activeBright;
  if (active) return STREAK_COLORS.active;
  return inactive;
}
