import { describe, expect, it } from 'vitest';

import { buildPartnerHeaderLine, formatPartnerClock, partnerClockAt } from '@/lib/partner-header-line';

describe('partner header line', () => {
  it('shows a short 12-hour time (the sun or moon says which half of the day)', () => {
    expect(partnerClockAt(0, 5).time).toBe('12:05');
    expect(partnerClockAt(9, 40).time).toBe('9:40');
    expect(partnerClockAt(12, 0).time).toBe('12:00');
    expect(partnerClockAt(21, 40).time).toBe('9:40');
  });

  it('knows day from night (sun from moon)', () => {
    expect(partnerClockAt(14, 15).isDaytime).toBe(true);
    expect(partnerClockAt(23, 40).isDaytime).toBe(false);
    expect(partnerClockAt(5, 30).isDaytime).toBe(false);
  });

  it('reads the clock in their timezone', () => {
    const clock = formatPartnerClock('Africa/Accra', new Date('2026-10-19T14:15:00Z'));
    expect(clock?.time).toBe('2:15');
    expect(formatPartnerClock('Not/AZone')).toBeNull();
  });

  it('joins what it has, no emoji', () => {
    expect(buildPartnerHeaderLine({ location: '4,812 km Away', clock: partnerClockAt(23, 40) })).toBe(
      '4,812 km Away · 11:40',
    );
    expect(buildPartnerHeaderLine({ location: null, clock: partnerClockAt(8, 0) })).toBe('8:00');
  });
});
