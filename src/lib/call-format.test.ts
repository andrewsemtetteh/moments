import { describe, expect, it } from 'vitest';

import { formatCallDuration } from '@/lib/call-format';

describe('call timer', () => {
  it('reads like a phone call timer', () => {
    expect(formatCallDuration(0)).toBe('0:00');
    expect(formatCallDuration(42_000)).toBe('0:42');
    expect(formatCallDuration(12 * 60_000 + 5_000)).toBe('12:05');
    expect(formatCallDuration(3_729_000)).toBe('1:02:09');
    expect(formatCallDuration(-5)).toBe('0:00');
  });
});
