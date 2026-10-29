/**
 * Flat, hand-drawn-style scenes for the Handpicked area cards: objects and shapes, no faces, in
 * each area's own colours. Each is an SVG (200 × 150, the top of the card) drawn with `SvgXml`.
 * Kept free of imports so the scenes can be previewed outside the app.
 */

export interface ArtPalette {
  /** The card's paper. */
  bg: string;
  /** The area's colour. */
  a: string;
  /** Deep ink (outlines, details). */
  d: string;
  /** Light tint of the area's colour. */
  l: string;
  w: string;
  /** Warm yellow highlight. */
  y: string;
  /** Pink (hearts). */
  k: string;
}

const HEART =
  'M12 21s-7.5-4.6-9.6-9.2C.9 7.6 3.4 3.5 7.3 3.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.9 0 6.4 4.1 4.9 8.3C19.5 16.4 12 21 12 21z';
export const heart = (x: number, y: number, s: number, fill: string, extra = '') =>
  `<path d="${HEART}" transform="translate(${x} ${y}) scale(${s / 24})" fill="${fill}" ${extra}/>`;
const spark = (x: number, y: number, s: number, fill: string) =>
  `<path d="M${x} ${y - s}C${x + s * 0.18} ${y - s * 0.18} ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y}C${x + s * 0.18} ${y + s * 0.18} ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s}C${x - s * 0.18} ${y + s * 0.18} ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y}C${x - s * 0.18} ${y - s * 0.18} ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z" fill="${fill}"/>`;

/** Soft shapes behind every scene, so they feel like one set. */
const backdrop = (c: ArtPalette) =>
  `<circle cx="162" cy="34" r="58" fill="${c.l}" opacity=".55"/><circle cx="18" cy="70" r="30" fill="${c.l}" opacity=".4"/>` +
  `<circle cx="40" cy="26" r="3" fill="${c.a}" opacity=".35"/><circle cx="182" cy="112" r="4" fill="${c.a}" opacity=".3"/>`;

export const wrap = (c: ArtPalette, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150">${backdrop(c)}${body}</svg>`;

export const AREA_ART: Record<string, (c: ArtPalette) => string> = {
  // Two speech bubbles: a question and a heart.
  knowing: (c) =>
    wrap(
      c,
      `<path d="M28 34h86a20 20 0 0 1 20 20v26a20 20 0 0 1-20 20H62l-18 16 4-16H28A20 20 0 0 1 8 80V54a20 20 0 0 1 20-20z" fill="${c.a}"/>` +
        `<circle cx="50" cy="67" r="6" fill="${c.w}"/><circle cx="71" cy="67" r="6" fill="${c.w}"/><circle cx="92" cy="67" r="6" fill="${c.w}"/>` +
        `<path d="M104 64h70a18 18 0 0 1 18 18v24a18 18 0 0 1-18 18h-8l4 14-18-14h-48a18 18 0 0 1-18-18V82a18 18 0 0 1 18-18z" fill="${c.w}" stroke="${c.d}" stroke-width="3"/>` +
        heart(127, 80, 30, c.k),
    ),
  // Polaroids on a string.
  story: (c) =>
    wrap(
      c,
      `<path d="M4 30Q100 62 196 30" fill="none" stroke="${c.d}" stroke-width="2.5"/>` +
        `<g transform="rotate(-9 46 76)"><rect x="18" y="40" width="58" height="68" rx="4" fill="${c.w}" stroke="${c.d}" stroke-width="2.5"/><rect x="25" y="47" width="44" height="40" rx="2" fill="${c.l}"/><circle cx="56" cy="58" r="6" fill="${c.y}"/><path d="M25 87l14-16 10 10 8-6 12 12z" fill="${c.a}"/></g>` +
        `<g transform="rotate(6 102 86)"><rect x="73" y="48" width="58" height="68" rx="4" fill="${c.w}" stroke="${c.d}" stroke-width="2.5"/><rect x="80" y="55" width="44" height="40" rx="2" fill="${c.a}"/>${heart(90, 62, 24, c.w)}</g>` +
        `<g transform="rotate(-4 158 74)"><rect x="129" y="38" width="58" height="68" rx="4" fill="${c.w}" stroke="${c.d}" stroke-width="2.5"/><rect x="136" y="45" width="44" height="40" rx="2" fill="${c.l}"/><circle cx="150" cy="65" r="8" fill="${c.a}"/><circle cx="166" cy="65" r="8" fill="${c.k}"/></g>` +
        `<rect x="40" y="36" width="8" height="12" rx="2" fill="${c.y}"/><rect x="98" y="44" width="8" height="12" rx="2" fill="${c.y}"/><rect x="154" y="34" width="8" height="12" rx="2" fill="${c.y}"/>`,
    ),
  // Two tumbling dice and confetti.
  fun: (c) =>
    wrap(
      c,
      `<g transform="rotate(-14 70 82)"><rect x="34" y="46" width="72" height="72" rx="16" fill="${c.w}" stroke="${c.d}" stroke-width="3"/>` +
        `<circle cx="54" cy="66" r="7" fill="${c.a}"/><circle cx="70" cy="82" r="7" fill="${c.a}"/><circle cx="86" cy="98" r="7" fill="${c.a}"/></g>` +
        `<g transform="rotate(16 136 70)"><rect x="106" y="40" width="62" height="62" rx="14" fill="${c.a}" stroke="${c.d}" stroke-width="3"/>` +
        `<circle cx="123" cy="57" r="6" fill="${c.w}"/><circle cx="151" cy="57" r="6" fill="${c.w}"/><circle cx="123" cy="85" r="6" fill="${c.w}"/><circle cx="151" cy="85" r="6" fill="${c.w}"/></g>` +
        `<rect x="22" y="24" width="10" height="5" rx="2" fill="${c.y}" transform="rotate(30 27 26)"/><rect x="170" y="118" width="12" height="5" rx="2" fill="${c.k}" transform="rotate(-25 176 120)"/>` +
        `<circle cx="112" cy="20" r="4" fill="${c.k}"/><circle cx="20" cy="104" r="4" fill="${c.y}"/>`,
    ),
  // Clinking glasses under string lights, with a candle.
  romance: (c) =>
    wrap(
      c,
      `<path d="M0 18Q50 40 100 22T200 20" fill="none" stroke="${c.d}" stroke-width="2"/>` +
        [16, 52, 88, 124, 160, 192]
          .map((x, i) => `<circle cx="${x}" cy="${[22, 30, 27, 21, 21, 19][i]}" r="5" fill="${c.y}"/>`)
          .join('') +
        `<g transform="rotate(-12 78 80)"><path d="M60 46h36l-4 30a14 14 0 0 1-28 0z" fill="${c.w}" stroke="${c.d}" stroke-width="3"/><path d="M63 60h30l-1.6 14a12 12 0 0 1-26.8 0z" fill="${c.a}"/><rect x="76" y="90" width="4" height="22" fill="${c.d}"/><rect x="66" y="110" width="24" height="5" rx="2" fill="${c.d}"/></g>` +
        `<g transform="rotate(12 122 80)"><path d="M104 46h36l-4 30a14 14 0 0 1-28 0z" fill="${c.w}" stroke="${c.d}" stroke-width="3"/><path d="M107 60h30l-1.6 14a12 12 0 0 1-26.8 0z" fill="${c.a}"/><rect x="120" y="90" width="4" height="22" fill="${c.d}"/><rect x="110" y="110" width="24" height="5" rx="2" fill="${c.d}"/></g>` +
        spark(100, 40, 9, c.y) +
        `<rect x="160" y="82" width="16" height="34" rx="3" fill="${c.w}" stroke="${c.d}" stroke-width="2.5"/><path d="M168 64c6 6 6 12 0 16-6-4-6-10 0-16z" fill="${c.y}"/>` +
        heart(16, 76, 22, c.k),
    ),
  // Two big overlapping hearts.
  intimacy: (c) =>
    wrap(
      c,
      heart(30, 24, 96, c.a, `stroke="${c.d}" stroke-width="0.7"`) +
        heart(84, 40, 86, c.k, `stroke="${c.d}" stroke-width="0.75" opacity=".95"`) +
        `<circle cx="22" cy="118" r="5" fill="${c.w}"/>`,
    ),
  // A phone with a conversation.
  communication: (c) =>
    wrap(
      c,
      `<rect x="58" y="14" width="84" height="134" rx="16" fill="${c.d}"/><rect x="64" y="22" width="72" height="120" rx="11" fill="${c.w}"/>` +
        `<rect x="70" y="34" width="44" height="16" rx="8" fill="${c.l}"/><rect x="86" y="56" width="44" height="16" rx="8" fill="${c.a}"/>` +
        `<rect x="70" y="78" width="36" height="16" rx="8" fill="${c.l}"/>${heart(110, 100, 18, c.k)}` +
        `<path d="M10 48h40a12 12 0 0 1 12 12v10a12 12 0 0 1-12 12H30l-12 10 3-10H10" fill="${c.a}" transform="translate(2 0)"/>` +
        `<circle cx="24" cy="65" r="3.5" fill="${c.w}"/><circle cx="35" cy="65" r="3.5" fill="${c.w}"/><circle cx="46" cy="65" r="3.5" fill="${c.w}"/>` +
        `<path d="M150 92h40a10 10 0 0 1 10 10v8a10 10 0 0 1-10 10h-8l2 9-12-9h-22a10 10 0 0 1-10-10v-8a10 10 0 0 1 10-10z" fill="${c.y}"/>`,
    ),
  // A padlock with a heart keyhole, and its key.
  trust: (c) =>
    wrap(
      c,
      `<path d="M68 70V52a32 32 0 0 1 64 0v18" fill="none" stroke="${c.d}" stroke-width="10" stroke-linecap="round"/>` +
        `<rect x="52" y="66" width="96" height="76" rx="18" fill="${c.a}" stroke="${c.d}" stroke-width="3"/>` +
        heart(84, 86, 32, c.w) +
        `<g transform="rotate(-30 168 112)"><circle cx="168" cy="96" r="12" fill="none" stroke="${c.y}" stroke-width="6"/><rect x="165" y="106" width="6" height="30" rx="2" fill="${c.y}"/><rect x="171" y="122" width="8" height="5" fill="${c.y}"/><rect x="171" y="130" width="6" height="5" fill="${c.y}"/></g>`,
    ),
  // A heart mended with a plaster.
  conflict: (c) =>
    wrap(
      c,
      heart(46, 18, 112, c.a, `stroke="${c.d}" stroke-width="0.6"`) +
        `<path d="M102 46l-8 14 10 8-8 16" fill="none" stroke="${c.d}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<g transform="rotate(-28 100 80)"><rect x="62" y="68" width="76" height="26" rx="13" fill="${c.y}" stroke="${c.d}" stroke-width="2.5"/><rect x="88" y="68" width="24" height="26" fill="${c.w}" opacity=".7"/>` +
        `<circle cx="94" cy="76" r="1.6" fill="${c.d}"/><circle cx="106" cy="76" r="1.6" fill="${c.d}"/><circle cx="94" cy="86" r="1.6" fill="${c.d}"/><circle cx="106" cy="86" r="1.6" fill="${c.d}"/></g>`,
    ),
  // Two map pins joined by a paper plane's dotted path.
  distance: (c) =>
    wrap(
      c,
      `<path d="M38 112C60 30 140 30 162 96" fill="none" stroke="${c.d}" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>` +
        `<path d="M38 132c-14-18-22-28-22-40a22 22 0 0 1 44 0c0 12-8 22-22 40z" fill="${c.a}" stroke="${c.d}" stroke-width="2.5"/>${heart(28, 80, 20, c.w)}` +
        `<path d="M162 132c-14-18-22-28-22-40a22 22 0 0 1 44 0c0 12-8 22-22 40z" fill="${c.k}" stroke="${c.d}" stroke-width="2.5"/>${heart(152, 80, 20, c.w)}` +
        `<g transform="translate(92 26) rotate(12)"><path d="M0 14L34 0 24 30 16 20z" fill="${c.w}" stroke="${c.d}" stroke-width="2.5" stroke-linejoin="round"/><path d="M16 20L34 0" stroke="${c.d}" stroke-width="2"/></g>`,
    ),
  // A little house with a heart window and a plant.
  home: (c) =>
    wrap(
      c,
      `<path d="M40 74L100 26l60 48" fill="${c.a}" stroke="${c.d}" stroke-width="3" stroke-linejoin="round"/>` +
        `<rect x="132" y="34" width="14" height="26" fill="${c.d}"/><path d="M139 30c-6-6 6-10 0-16" fill="none" stroke="${c.w}" stroke-width="3" stroke-linecap="round"/>` +
        `<rect x="52" y="70" width="96" height="70" fill="${c.w}" stroke="${c.d}" stroke-width="3"/>` +
        `<path d="M40 74L100 26l60 48z" fill="${c.a}" stroke="${c.d}" stroke-width="3" stroke-linejoin="round"/>` +
        `<rect x="88" y="100" width="24" height="40" rx="4" fill="${c.a}" stroke="${c.d}" stroke-width="2.5"/><circle cx="106" cy="121" r="2" fill="${c.y}"/>` +
        `<rect x="62" y="84" width="20" height="20" rx="3" fill="${c.y}" stroke="${c.d}" stroke-width="2"/>${heart(119, 82, 22, c.k)}` +
        `<path d="M162 140h22l-3-18h-16z" fill="${c.a}" stroke="${c.d}" stroke-width="2.5"/><path d="M172 122c-10-10-4-22 0-24 4 2 10 14 0 24z" fill="${c.l}" stroke="${c.d}" stroke-width="2"/>`,
    ),
  // A row of friendly figures, big and small.
  family: (c) => {
    // A figure standing on the ground line: a rounded body and a head with a little gap above it.
    const person = (x: number, h: number, body: string, head: string) => {
      const w = h * 0.5;
      const top = 142 - h * 0.62;
      const r = h * 0.17;
      return (
        `<path d="M${x - w / 2} 142V${top + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V142z" fill="${body}" stroke="${c.d}" stroke-width="2.5"/>` +
        `<circle cx="${x}" cy="${top - r - 4}" r="${r}" fill="${head}" stroke="${c.d}" stroke-width="2.5"/>`
      );
    };
    return wrap(
      c,
      person(36, 96, c.a, c.y) +
        person(80, 66, c.y, c.w) +
        person(120, 70, c.l, c.y) +
        person(164, 100, c.k, c.w) +
        heart(88, 30, 24, c.k),
    );
  },
  // A piggy bank with a coin going in.
  money: (c) =>
    wrap(
      c,
      `<ellipse cx="96" cy="96" rx="58" ry="42" fill="${c.k}" stroke="${c.d}" stroke-width="3"/>` +
        `<path d="M70 62l-6-20 18 12z" fill="${c.k}" stroke="${c.d}" stroke-width="3" stroke-linejoin="round"/>` +
        `<rect x="146" y="84" width="22" height="24" rx="9" fill="${c.k}" stroke="${c.d}" stroke-width="3"/><circle cx="154" cy="96" r="2.4" fill="${c.d}"/><circle cx="161" cy="96" r="2.4" fill="${c.d}"/>` +
        `<circle cx="126" cy="82" r="3.5" fill="${c.d}"/><rect x="80" y="58" width="30" height="6" rx="3" fill="${c.d}"/>` +
        `<rect x="62" y="130" width="14" height="14" rx="4" fill="${c.k}" stroke="${c.d}" stroke-width="2.5"/><rect x="112" y="130" width="14" height="14" rx="4" fill="${c.k}" stroke="${c.d}" stroke-width="2.5"/>` +
        `<path d="M40 92c-10 0-14-8-8-12" fill="none" stroke="${c.d}" stroke-width="3" stroke-linecap="round"/>` +
        `<circle cx="95" cy="30" r="15" fill="${c.y}" stroke="${c.d}" stroke-width="3"/><rect x="92" y="22" width="6" height="16" rx="2" fill="${c.a}"/>` +
        `<ellipse cx="170" cy="136" rx="16" ry="5" fill="${c.y}" stroke="${c.d}" stroke-width="2"/><ellipse cx="170" cy="129" rx="16" ry="5" fill="${c.y}" stroke="${c.d}" stroke-width="2"/>`,
    ),
  // A sprout in a pot under the sun.
  growth: (c) =>
    wrap(
      c,
      `<circle cx="158" cy="38" r="20" fill="${c.y}"/>` +
        [0, 45, 90, 135, 180, 225, 270, 315]
          .map(
            (deg) =>
              `<rect x="156" y="6" width="4" height="10" rx="2" fill="${c.y}" transform="rotate(${deg} 158 38)"/>`,
          )
          .join('') +
        `<path d="M100 104V58" stroke="${c.d}" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="M100 76C78 78 64 62 66 44c20 0 34 12 34 32z" fill="${c.a}" stroke="${c.d}" stroke-width="2.5"/>` +
        `<path d="M100 64c4-22 22-32 40-28 0 20-16 30-40 28z" fill="${c.l}" stroke="${c.d}" stroke-width="2.5"/>` +
        `<path d="M66 100h68l-8 44H74z" fill="${c.a}" stroke="${c.d}" stroke-width="3" stroke-linejoin="round"/><rect x="60" y="96" width="80" height="12" rx="4" fill="${c.k}" stroke="${c.d}" stroke-width="3"/>` +
        heart(88, 112, 24, c.w),
    ),
  // A hot-air balloon over the clouds.
  future: (c) =>
    wrap(
      c,
      `<path d="M100 14c30 0 46 22 46 44 0 22-22 40-32 54H86C76 98 54 80 54 58c0-22 16-44 46-44z" fill="${c.a}" stroke="${c.d}" stroke-width="3"/>` +
        `<path d="M100 14c-12 0-18 22-18 44s8 40 10 54M100 14c12 0 18 22 18 44s-8 40-10 54" fill="none" stroke="${c.d}" stroke-width="2"/>` +
        `<path d="M82 58c0-22 6-44 18-44s18 22 18 44-8 40-10 54H92C90 98 82 80 82 58z" fill="${c.k}"/>` +
        `<path d="M88 112l2 14M112 112l-2 14" stroke="${c.d}" stroke-width="2"/><rect x="86" y="124" width="28" height="18" rx="4" fill="${c.y}" stroke="${c.d}" stroke-width="2.5"/>` +
        `<path d="M8 138a16 16 0 0 1 28-10 14 14 0 0 1 24 8H8z" fill="${c.w}"/><path d="M140 120a14 14 0 0 1 24-8 12 12 0 0 1 22 8z" fill="${c.w}"/>` +
        `<circle cx="180" cy="70" r="3" fill="${c.w}"/>`,
    ),
};
