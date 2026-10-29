export interface PartnerClock {
  /** "9:40": 12-hour, no AM/PM (the header's sun or moon after it says which). */
  time: string;
  /** 11pm to 7am where they are: probably asleep. */
  isOvernight: boolean;
  /** 6am to 7pm where they are: the header shows a sun, otherwise a moon. */
  isDaytime: boolean;
}

/** The clock for an hour and minute where they are. */
export function partnerClockAt(hour: number, minute: number): PartnerClock {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return {
    time: `${h12}:${String(minute).padStart(2, '0')}`,
    isOvernight: hour >= 23 || hour < 7,
    isDaytime: hour >= 6 && hour < 19,
  };
}

/**
 * Client-side clock computed from a stored IANA zone, not a server timestamp —
 * stays correct while offline and survives DST. Returns null until a timezone
 * is known (e.g. the partner hasn't opened a build that syncs one yet).
 */
export function formatPartnerClock(timezone: string | null | undefined, now = new Date()): PartnerClock | null {
  if (!timezone) return null;

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);

    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return partnerClockAt(hour, minute);
  } catch {
    // Unrecognized/invalid IANA zone.
    return null;
  }
}

interface BuildPartnerHeaderLineArgs {
  /** e.g. "5,712 km Away" or "Same City" */
  location?: string | null;
  clock?: PartnerClock | null;
  statusLabel?: string | null;
}

/**
 * Joins whatever segments are available with " · " — e.g. "5,712 km Away · 9:40 · online" —
 * skipping missing ones so it never leaves a dangling separator. (The header draws a sun or
 * moon icon after the time; see AppHeader.)
 */
export function buildPartnerHeaderLine({ location, clock, statusLabel }: BuildPartnerHeaderLineArgs): string {
  const locationSegment = location?.trim() || null;
  const statusSegment = statusLabel?.trim() || null;
  return [locationSegment, clock?.time ?? null, statusSegment].filter(Boolean).join(' · ');
}
