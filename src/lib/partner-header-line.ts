export interface PartnerClock {
  time: string;
  isOvernight: boolean;
}

/**
 * Client-side clock computed from a stored IANA zone, not a server timestamp —
 * stays correct while offline and survives DST. Returns null until a timezone
 * is known (e.g. the partner hasn't opened a build that syncs one yet).
 */
export function formatPartnerClock(timezone: string | null | undefined): PartnerClock | null {
  if (!timezone) return null;

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());

    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = parts.find((p) => p.type === 'minute')?.value;
    if (!Number.isFinite(hour) || minute == null) return null;

    const time = `${String(hour).padStart(2, '0')}:${minute}`;
    const isOvernight = hour >= 23 || hour < 7;
    return { time, isOvernight };
  } catch {
    // Unrecognized/invalid IANA zone.
    return null;
  }
}

interface BuildPartnerHeaderLineArgs {
  /** e.g. "5,712 km apart" or "same city" */
  location?: string | null;
  clock?: PartnerClock | null;
  statusLabel?: string | null;
  /** Appended to the clock segment when it's overnight for the partner, e.g. "🌙" — pass '' to omit. */
  overnightGlyph?: string;
}

/**
 * Joins whatever segments are available with " · " — e.g. "5,712 km apart · 21:40 · online" —
 * skipping missing ones so it never leaves a dangling separator.
 */
export function buildPartnerHeaderLine({
  location,
  clock,
  statusLabel,
  overnightGlyph = ' 🌙',
}: BuildPartnerHeaderLineArgs): string {
  const timeSegment = clock ? `${clock.time}${clock.isOvernight ? overnightGlyph : ''}` : null;
  const locationSegment = location?.trim() || null;
  const statusSegment = statusLabel?.trim() || null;

  return [locationSegment, timeSegment, statusSegment].filter(Boolean).join(' · ');
}
