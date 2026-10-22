import { addYears, differenceInCalendarDays, format, isLeapYear, startOfDay } from 'date-fns';

/** A YYYY-MM-DD birthday as a local date (noon, so time zones never shift the day). */
export function parseBirthday(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The next time it's their birthday (today counts). 29 Feb is celebrated on 28 Feb in other years. */
export function nextBirthday(iso: string | null | undefined, now = new Date()): Date | null {
  const born = parseBirthday(iso);
  if (!born) return null;
  const today = startOfDay(now);
  const on = (year: number) => {
    const feb29 = born.getMonth() === 1 && born.getDate() === 29;
    const day = feb29 && !isLeapYear(new Date(year, 0, 1)) ? 28 : born.getDate();
    return new Date(year, born.getMonth(), day);
  };
  const thisYear = on(today.getFullYear());
  return thisYear >= today ? thisYear : on(addYears(today, 1).getFullYear());
}

/** Days until their birthday: 0 on the day. */
export function daysUntilBirthday(iso: string | null | undefined, now = new Date()): number | null {
  const next = nextBirthday(iso, now);
  return next ? differenceInCalendarDays(next, startOfDay(now)) : null;
}

/** The age they turn on their next birthday. */
export function turningAge(iso: string | null | undefined, now = new Date()): number | null {
  const born = parseBirthday(iso);
  const next = nextBirthday(iso, now);
  return born && next ? next.getFullYear() - born.getFullYear() : null;
}

/** "Friday 24 October" */
export function birthdayDayLabel(date: Date): string {
  return format(date, 'EEEE d MMMM');
}

/** "24 October" (no year: what your partner sees in Settings and the profile). */
export function birthdayShortLabel(iso: string | null | undefined): string {
  const born = parseBirthday(iso);
  return born ? format(born, 'd MMMM') : 'Not set';
}

/** Moments is for people 16 and over (Terms of Service). */
export const MIN_AGE = 16;

/** How old someone born on this date is today. */
export function ageOn(iso: string | null | undefined, now = new Date()): number | null {
  const born = parseBirthday(iso);
  if (!born) return null;
  const hadBirthday =
    now.getMonth() > born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() >= born.getDate());
  return now.getFullYear() - born.getFullYear() - (hadBirthday ? 0 : 1);
}

/** Old enough for Moments (16+). */
export function isOldEnough(iso: string | null | undefined, now = new Date()): boolean {
  const age = ageOn(iso, now);
  return age != null && age >= MIN_AGE;
}

/** The latest year a 16-year-old could be born in: the birthday wheels stop there. */
export function latestBirthYear(now = new Date()): number {
  return now.getFullYear() - MIN_AGE;
}
