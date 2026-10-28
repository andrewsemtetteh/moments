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

/**
 * The day a missed streak actually ended: freezes would have covered the first missed
 * days, so it ends at the start of the day after the first one they couldn't.
 */
export function streakLostDay(last: string, freezes: number): string {
  return shiftDay(last, 2 + Math.max(0, freezes));
}

/** When `day` began where this person is (its local midnight), in ms; UTC when unknown. */
export function localMidnightMs(day: string, timeZone: string | null | undefined): number {
  const utcMidnight = Date.parse(`${day}T00:00:00Z`);
  const zone = timeZone?.trim();
  if (!zone) return utcMidnight;
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const offsetAt = (ms: number) => {
      const parts = fmt.formatToParts(new Date(ms));
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
      const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
      return asUtc - Math.floor(ms / 1000) * 1000;
    };
    // Twice, so a daylight-saving change near midnight lands on the right offset.
    let guess = utcMidnight - offsetAt(utcMidnight);
    guess = utcMidnight - offsetAt(guess);
    return guess;
  } catch {
    return utcMidnight;
  }
}
