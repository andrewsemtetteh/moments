import { describe, expect, it } from 'vitest';

import { mediaCacheKey, mediaSource } from '@/lib/media-cache-key';

describe('media cache keys', () => {
  const base = 'https://api.example.com/media/moments/rel/user/photo.jpg';

  it('drops the weekly signature, so a re-signed link hits the same cached photo', () => {
    expect(mediaCacheKey(`${base}?e=1700000000&s=abc`)).toBe(base);
    expect(mediaCacheKey(`${base}?e=1800000000&s=xyz`)).toBe(base);
  });

  it('keeps the small-copy flag (it is a different picture)', () => {
    expect(mediaCacheKey(`${base}?e=1&s=a&t=1`)).toBe(`${base}?t=1`);
  });

  it('leaves files that are not ours, or have no query, alone', () => {
    expect(mediaCacheKey('file:///tmp/a.jpg')).toBeUndefined();
    expect(mediaCacheKey(base)).toBeUndefined();
    expect(mediaSource('https://images.example.com/x.jpg?w=1')).toEqual({ uri: 'https://images.example.com/x.jpg?w=1' });
  });
});
