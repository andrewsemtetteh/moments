/**
 * Checks on profile fields, shared by every way a profile is written (PATCH /me from
 * onboarding, and the table route Settings uses), so neither can skip them.
 */

/** Moments is for 16 and over (Terms of Service). Keep in sync with MIN_AGE in src/lib/birthday.ts. */
export const MIN_AGE = 16;

/** The genders you can pick (or none). Older answers stay valid. */
export const GENDER_IDENTITIES = new Set([
  'male',
  'female',
  'non_binary',
  'other',
  'prefer_not_to_say',
  // From before the list was trimmed.
  'genderqueer',
  'genderfluid',
  'agender',
]);

/** Why this profile change isn't allowed, or null when it's fine. */
export function profileUpdateError(body: Record<string, unknown>, now = new Date()): string | null {
  if ('gender_identity' in body && body.gender_identity !== null && !GENDER_IDENTITIES.has(String(body.gender_identity))) {
    return 'Pick one of the listed options';
  }
  if ('birthday' in body && body.birthday !== null) {
    const b = String(body.birthday);
    const d = new Date(`${b}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(b) ||
      Number.isNaN(d.getTime()) ||
      d.toISOString().slice(0, 10) !== b ||
      d.getTime() > now.getTime() ||
      d.getUTCFullYear() < 1900
    ) {
      return 'That birthday doesn’t look right';
    }
    // Their 16th birthday must have come, anywhere in the world (14 hours covers the
    // time zones ahead of UTC).
    const sixteenth = Date.UTC(d.getUTCFullYear() + MIN_AGE, d.getUTCMonth(), d.getUTCDate(), 0);
    if (sixteenth > now.getTime() + 14 * 3600_000) return `Moments is for people ${MIN_AGE} and over`;
  }
  return null;
}
