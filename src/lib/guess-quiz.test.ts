import { describe, expect, it } from 'vitest';

import { askPartner } from '@/lib/guess-quiz';

describe('askPartner', () => {
  it('puts the question to them by name', () => {
    expect(askPartner('Sam', 'Dream first-date redo?')).toBe('Sam, dream first-date redo?');
    expect(askPartner('Sam', 'What makes you feel most loved?')).toBe('Sam, what makes you feel most loved?');
  });
  it('keeps "I" and capitals', () => {
    expect(askPartner('Sam', 'I’d rather…?')).toBe('Sam, I’d rather…?');
    expect(askPartner('Sam', 'TV on or off?')).toBe('Sam, TV on or off?');
    expect(askPartner('Sam', 'I am the one who…?')).toBe('Sam, I am the one who…?');
    expect(askPartner('Sam', 'Is it romantic?')).toBe('Sam, is it romantic?');
  });
});
