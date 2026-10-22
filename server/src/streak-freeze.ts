/** Streak freezes (like Duolingo's): pure rules, shared by the streak code and its tests. */

/** Streak freezes (like Duolingo's): you hold up to this many… */
export const MAX_STREAK_FREEZES = 2;
/** …and earn one each time your streak reaches a multiple of this. */
export const FREEZE_EVERY_DAYS = 7;

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Days between two YYYY-MM-DD dates (b − a). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * The days a freeze would cover: every day after your last check-in up to yesterday.
 * Empty when nothing was missed; null when more were missed than your freezes cover.
 */
export function daysToFreeze(last: string | null, today: string, freezes: number): string[] | null {
  if (!last) return null;
  const missed = daysBetween(last, today) - 1;
  if (missed <= 0) return [];
  if (missed > freezes) return null;
  return Array.from({ length: missed }, (_, i) => shiftDay(last, i + 1));
}
