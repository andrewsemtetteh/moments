/**
 * Flat drawings for the Endless games, in the same style as the area scenes (area-art.ts): objects,
 * ink outlines, no faces. Each is an SVG (200 × 150) drawn with `SvgXml`.
 */
import { heart, wrap, type ArtPalette } from './area-art';

const KAHOOT = ['#E21B3C', '#1368CE', '#D89E00', '#26890C'];

export const GAME_ART: Record<string, (c: ArtPalette) => string> = {
  // Two doors side by side, one with a heart: pick one.
  wouldYouRather: (c) =>
    wrap(
      c,
      `<rect x="34" y="34" width="56" height="102" rx="26" fill="${c.a}" stroke="${c.d}" stroke-width="3"/><circle cx="78" cy="88" r="4" fill="${c.y}"/>` +
        `<rect x="110" y="34" width="56" height="102" rx="26" fill="${c.w}" stroke="${c.d}" stroke-width="3"/><circle cx="122" cy="88" r="4" fill="${c.a}"/>` +
        heart(126, 56, 24, c.k) +
        `<rect x="40" y="136" width="120" height="6" rx="3" fill="${c.d}"/>` +
        `<path d="M62 18c0-8 12-8 12 0 0 6-6 6-6 12" fill="none" stroke="${c.d}" stroke-width="3.5" stroke-linecap="round"/>`,
    ),
  // Two cards split by a lightning bolt.
  thisOrThat: (c) =>
    wrap(
      c,
      `<g transform="rotate(-10 62 80)"><rect x="24" y="36" width="70" height="92" rx="14" fill="${c.a}" stroke="${c.d}" stroke-width="3"/>${heart(41, 64, 36, c.w)}</g>` +
        `<g transform="rotate(10 138 80)"><rect x="106" y="36" width="70" height="92" rx="14" fill="${c.w}" stroke="${c.d}" stroke-width="3"/><circle cx="141" cy="82" r="18" fill="${c.y}" stroke="${c.d}" stroke-width="2.5"/></g>` +
        `<path d="M106 16L84 76h20l-10 52 30-66h-20l12-46z" fill="${c.y}" stroke="${c.d}" stroke-width="3" stroke-linejoin="round"/>`,
    ),
  // A hand pointing at one of two badges.
  whosLikely: (c) =>
    wrap(
      c,
      `<circle cx="52" cy="54" r="26" fill="${c.a}" stroke="${c.d}" stroke-width="3"/>${heart(40, 42, 24, c.w)}` +
        `<circle cx="148" cy="54" r="26" fill="${c.k}" stroke="${c.d}" stroke-width="3"/>${heart(136, 42, 24, c.w)}` +
        `<path d="M86 132v-30c0-6 8-6 8 0v-8c0-6 8-6 8 0v4c0-6 8-6 8 0v6c0-6 8-6 8 0v24c0 10-6 16-16 16h-8c-10 0-16-6-16-12z" fill="${c.w}" stroke="${c.d}" stroke-width="3" stroke-linejoin="round"/>` +
        `<path d="M94 94V58c0-6 8-6 8 0v36" fill="${c.w}" stroke="${c.d}" stroke-width="3" stroke-linejoin="round"/>` +
        `<path d="M98 50l-28-6" stroke="${c.d}" stroke-width="2.5" stroke-dasharray="3 5" stroke-linecap="round"/>`,
    ),
  // A flame and a secret: truth or dare.
  truthDare: (c) =>
    wrap(
      c,
      `<g transform="rotate(-8 64 84)"><rect x="28" y="40" width="72" height="92" rx="14" fill="${c.w}" stroke="${c.d}" stroke-width="3"/>` +
        `<path d="M48 66h32a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H62l-8 7 1-7h-7a8 8 0 0 1-8-8V74a8 8 0 0 1 8-8z" fill="${c.l}" stroke="${c.d}" stroke-width="2.5"/>` +
        `<circle cx="56" cy="81" r="3" fill="${c.d}"/><circle cx="64" cy="81" r="3" fill="${c.d}"/><circle cx="72" cy="81" r="3" fill="${c.d}"/></g>` +
        `<g transform="rotate(8 138 84)"><rect x="102" y="40" width="72" height="92" rx="14" fill="${c.a}" stroke="${c.d}" stroke-width="3"/>` +
        `<path d="M138 58c14 14 18 24 12 36a14 14 0 0 1-24 0c-4-8 0-14 4-18 0 6 4 8 6 8-4-10 0-18 2-26z" fill="${c.y}" stroke="${c.d}" stroke-width="2.5" stroke-linejoin="round"/></g>`,
    ),
  // A crystal ball with a heart: read their mind.
  guessAnswer: (c) =>
    wrap(
      c,
      `<circle cx="100" cy="66" r="44" fill="${c.l}" stroke="${c.d}" stroke-width="3"/>` +
        `<path d="M74 46a30 30 0 0 1 20-14" fill="none" stroke="${c.w}" stroke-width="5" stroke-linecap="round"/>` +
        heart(82, 52, 36, c.k) +
        `<path d="M66 108h68l10 26H56z" fill="${c.a}" stroke="${c.d}" stroke-width="3" stroke-linejoin="round"/>` +
        `<rect x="50" y="132" width="100" height="10" rx="4" fill="${c.d}"/>` +
        `<circle cx="160" cy="38" r="4" fill="${c.y}"/><circle cx="42" cy="44" r="3" fill="${c.y}"/>`,
    ),
  // Three cards: two true, one with a cross.
  twoTruths: (c) => {
    const card = (x: number, rot: number, fill: string, mark: string) =>
      `<g transform="rotate(${rot} ${x + 24} 84)"><rect x="${x}" y="46" width="48" height="76" rx="10" fill="${fill}" stroke="${c.d}" stroke-width="3"/>${mark}</g>`;
    const tick = (x: number) =>
      `<path d="M${x + 13} 84l7 8 15-17" fill="none" stroke="${c.a}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    const cross = (x: number) =>
      `<path d="M${x + 15} 72l18 22M${x + 33} 72l-18 22" stroke="${c.w}" stroke-width="5" stroke-linecap="round"/>`;
    return wrap(c, card(26, -10, c.w, tick(26)) + card(76, 0, c.k, cross(76)) + card(126, 10, c.w, tick(126)));
  },
  // A stopwatch with the four answer shapes.
  quiz: (c) =>
    wrap(
      c,
      `<rect x="62" y="14" width="22" height="10" rx="3" fill="${c.d}"/><circle cx="73" cy="78" r="50" fill="${c.w}" stroke="${c.d}" stroke-width="3"/>` +
        `<path d="M73 78V44" stroke="${c.a}" stroke-width="5" stroke-linecap="round"/><path d="M73 78l20 12" stroke="${c.d}" stroke-width="4" stroke-linecap="round"/><circle cx="73" cy="78" r="5" fill="${c.d}"/>` +
        `<path d="M158 24l14 24h-28z" fill="${KAHOOT[0]}"/><path d="M158 60l12 12-12 12-12-12z" fill="${KAHOOT[1]}"/>` +
        `<circle cx="158" cy="104" r="11" fill="${KAHOOT[2]}"/><rect x="147" y="122" width="22" height="22" rx="2" fill="${KAHOOT[3]}"/>`,
    ),
};
