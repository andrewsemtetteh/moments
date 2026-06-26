/** Streak calendar palette. */
export const STREAK_COLORS = {
  success: '#00E676',
  successBright: '#00C853',
  successSoft: 'rgba(0, 230, 118, 0.38)',
  successFill: 'rgba(0, 200, 83, 0.55)',
  pending: '#FACC15',
  pendingBright: '#EAB308',
  pendingSoft: 'rgba(250, 204, 21, 0.28)',
  atRisk: '#E85D04',
  atRiskDeep: '#C2410C',
  atRiskSoft: 'rgba(232, 93, 4, 0.22)',
  onLight: '#FFFFFF',
  onPending: '#1A1A1A',
  /** Activity-only days (not full streak) */
  streak: '#FACC15',
  streakBright: '#EAB308',
  streakSoft: 'rgba(250, 204, 21, 0.22)',
  onStreak: '#1A1A1A',
  onSuccess: '#FFFFFF',
  /** @deprecated — restore banner */
  flame: '#FACC15',
  flameSoft: 'rgba(250, 204, 21, 0.22)',
  onFlame: '#1A1A1A',
} as const;

export function streakFireColor(
  active: boolean,
  atRisk: boolean,
  inactive = '#8E8E93',
  successful = false,
): string {
  if (atRisk) return STREAK_COLORS.atRisk;
  if (successful) return STREAK_COLORS.success;
  if (active) return STREAK_COLORS.pending;
  return inactive;
}
