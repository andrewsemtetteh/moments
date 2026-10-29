import type { PlayTone } from '@/components/activities/explore/explore-catalog';
import { shade } from '@/components/games/room-ui';

import type { ArtPalette } from './area-art';

/**
 * The illustrated cards' colours, from a Play tone: pastel paper, the tone itself, a deep ink for
 * outlines and titles, and a light tint. Shared by the area, game and pack cards so they match.
 */
export function illustrationPalette(tone: PlayTone): ArtPalette {
  return {
    bg: tone.wash[1],
    a: tone.accent,
    d: shade(tone.accent, -0.55),
    l: mixWithWhite(tone.accent, 0.6),
    w: '#FFFFFF',
    y: '#FFC857',
    k: '#FF7A9A',
  };
}

export function mixWithWhite(hex: string, t: number): string {
  const h = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `#${rgb
    .map((v) =>
      Math.round(v + (255 - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
