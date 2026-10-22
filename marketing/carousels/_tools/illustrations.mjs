// Brand illustrations for slideshow covers: flat vector scenes with soft gradient shading, drawn from
// the theme palette (a = coral accent, card = white, back1/back2 = lighter night-blue tones).
// Add one entry per topic; posts pick it with `"illustration": "<name>"` in post.json.

// ---- Reusable figure helper -------------------------------------------------------
// One front-facing bust: head on a short neck tucked under the shirt, collar opening, hair,
// eyes and mouth. Use with figureDefs(prefix) inside <defs>.
const INK = { A: '#3A2230', B: '#2A1810' };
const NECK = { A: '#E8B08C', B: '#8A5638' };
export const figureDefs = (px) => `
  <linearGradient id="${px}A" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/></linearGradient>
  <linearGradient id="${px}B" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/></linearGradient>
  <linearGradient id="${px}FadeG" x1="0" y1="0" x2="0" y2="1"><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#fff"/></linearGradient>
  <mask id="${px}Fade"><rect x="0" y="0" width="640" height="480" fill="url(#${px}FadeG)"/></mask>`;

// One arm from the shoulder: sleeve-colored upper arm, skin forearm, a hand at the end.
// Start arms inside the torso at about (cx ± 34, 324) so the rounded sleeve never pokes out past the shoulder.
export function arm({ px, skin = 'A', sleeve, from, elbow, hand }) {
  const handFill = skin === 'A' ? '#EDB894' : '#93603F';
  return `
    <path d="M${from[0]} ${from[1]}L${elbow[0]} ${elbow[1]}" stroke="${sleeve}" stroke-width="26" stroke-linecap="round"/>
    <path d="M${elbow[0]} ${elbow[1]}L${hand[0]} ${hand[1]}" stroke="url(#${px}${skin})" stroke-width="16" stroke-linecap="round"/>
    <circle cx="${hand[0]}" cy="${hand[1]}" r="11" fill="${handFill}"/>`;
}

// A hand held up with fingers raised (for counting games). Draw after arm() at the same point.
export function fingers(x, y, skin = 'A', n = 3) {
  const c = skin === 'A' ? '#EDB894' : '#93603F';
  return Array.from({ length: n }, (_, i) => `<rect x="${x - 10 + i * 8}" y="${y - 30}" width="7" height="24" rx="3.5" fill="${c}"/>`).join('');
}

export function bust({ px, cx, skin = 'A', shirt, hair = 'long', tilt = 0, eyes = 'open', mouth = 'smile', blush = skin === 'A', brows = '' }) {
  const ink = INK[skin], neck = NECK[skin];
  const hy = 232;
  const back = hair === 'long' ? `<path d="M${cx - 42} 300c-10-62 6-118 42-118s52 56 42 118z" fill="#2B1E3F"/>` : '';
  const eyeMarks = {
    open: `<circle cx="${cx - 11}" cy="${hy + 6}" r="3.6" fill="${ink}"/><circle cx="${cx + 11}" cy="${hy + 6}" r="3.6" fill="${ink}"/>`,
    left: `<circle cx="${cx - 17}" cy="${hy + 6}" r="3.6" fill="${ink}"/><circle cx="${cx + 5}" cy="${hy + 6}" r="3.6" fill="${ink}"/>`,
    right: `<circle cx="${cx - 5}" cy="${hy + 6}" r="3.6" fill="${ink}"/><circle cx="${cx + 17}" cy="${hy + 6}" r="3.6" fill="${ink}"/>`,
    happy: `<path d="M${cx - 17} ${hy + 7}q6-6 12 0M${cx + 5} ${hy + 7}q6-6 12 0" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    closed: `<path d="M${cx - 17} ${hy + 5}q6 5 12 0M${cx + 5} ${hy + 5}q6 5 12 0" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    wide: `<circle cx="${cx - 11}" cy="${hy + 5}" r="6.5" fill="#FFFFFF"/><circle cx="${cx + 11}" cy="${hy + 5}" r="6.5" fill="#FFFFFF"/><circle cx="${cx - 10}" cy="${hy + 6}" r="3.6" fill="${ink}"/><circle cx="${cx + 12}" cy="${hy + 6}" r="3.6" fill="${ink}"/>`,
  }[eyes];
  const browMarks = brows === 'raised'
    ? `<path d="M${cx - 18} ${hy - 8}q6-6 12-2M${cx + 6} ${hy - 10}q6-4 12 2" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`
    : brows === 'sly'
    ? `<path d="M${cx - 18} ${hy - 4}l12 3M${cx + 6} ${hy - 1}l12-3" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>` : '';
  const mouthMark = {
    smile: `<path d="M${cx - 8} ${hy + 22}q8 6 16 0" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`,
    grin: `<path d="M${cx - 12} ${hy + 20}q12 14 24 0z" fill="${ink}"/>`,
    smirk: `<path d="M${cx - 8} ${hy + 22}q10 6 18-4" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>`,
    o: `<ellipse cx="${cx}" cy="${hy + 24}" rx="5" ry="6.5" fill="${ink}"/>`,
    flat: `<path d="M${cx - 7} ${hy + 24}h14" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`,
  }[mouth];
  const front = hair === 'long'
    ? `<path d="M${cx - 38} ${hy - 4}c-2-32 22-50 44-48 24 2 38 18 36 40-14-14-46-18-80 8z" fill="#2B1E3F"/>`
    : `<path d="M${cx - 37} ${hy - 10}c-4-34 18-52 40-52 26 0 40 18 36 46-10-12-22-16-38-16s-28 8-38 22z" fill="#18121F"/>`;
  const ears = hair === 'short' ? `<circle cx="${cx - 37}" cy="${hy + 4}" r="8" fill="${neck}"/><circle cx="${cx + 37}" cy="${hy + 4}" r="8" fill="${neck}"/>` : '';
  return `
    ${back}
    <rect x="${cx - 12}" y="258" width="24" height="42" rx="10" fill="${neck}"/>
    <path d="M${cx - 82} 480c-2-134 32-204 82-204s84 70 82 204z" fill="${shirt}"/>
    <path d="M${cx - 13} 278q13 15 26 0z" fill="${neck}"/>
    <g transform="rotate(${tilt} ${cx} ${hy})">
      ${ears}
      <circle cx="${cx}" cy="${hy}" r="38" fill="url(#${px}${skin})"/>
      ${front}${browMarks}${eyeMarks}${mouthMark}
      ${blush ? `<ellipse cx="${cx - 20}" cy="${hy + 20}" rx="7" ry="4.5" fill="#FF4D6D" opacity=".25"/><ellipse cx="${cx + 20}" cy="${hy + 20}" rx="7" ry="4.5" fill="#FF4D6D" opacity=".25"/>` : ''}
    </g>`;
}

// Cover illustrations are drawn in a 640×480 box.
export const ILLUSTRATIONS = {
  // Bedtime: a couple asleep under one blanket, heads leaning in, window and bedside lamp behind.
  bedtime: ({ a, card, back1, back2 }) => `
    <svg width="640" height="480" viewBox="0 0 640 480" fill="none">
      <defs>
        <linearGradient id="blanket" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${a}"/>
        </linearGradient>
        <linearGradient id="pillow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${card}"/><stop offset="1" stop-color="${card}"/>
        </linearGradient>
        <linearGradient id="headboard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4A4582"/><stop offset="1" stop-color="#4A4582"/>
        </linearGradient>
        <radialGradient id="glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="#FFD9A0" stop-opacity=".55"/><stop offset="1" stop-color="#FFD9A0" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="skinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="skinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <mask id="moon"><rect width="640" height="480" fill="#fff"/><circle cx="252" cy="62" r="15" fill="#000"/></mask>
      </defs>

      <!-- lamp glow (behind everything) -->
      <circle cx="582" cy="262" r="58" fill="url(#glow)" transform="translate(582 262) scale(1 1.5) translate(-582 -262)"/>

      <!-- window with curtains -->
      <rect x="196" y="34" width="168" height="132" rx="10" fill="${back2}"/>
      <circle cx="242" cy="72" r="18" fill="#FFE7C4" mask="url(#moon)"/>
      <path d="M280 34v132M196 100h168" stroke="${back1}" stroke-width="7"/>
      <rect x="196" y="34" width="168" height="132" rx="10" stroke="${back1}" stroke-width="8"/>
      <path d="M176 22h208" stroke="#4A4582" stroke-width="6" stroke-linecap="round"/>
      <path d="M180 24h34c-6 40 4 90-4 156h-30c8-60-6-110 0-156z" fill="#4A4582"/>
      <path d="M380 24h-34c6 40-4 90 4 156h30c-8-60 6-110 0-156z" fill="#4A4582"/>
      <path d="M196 30c-2 40 6 94 0 146M364 30c2 40-6 94 0 146" stroke="${back2}" stroke-opacity=".45" stroke-width="3"/>

      <!-- nightstand + lamp -->
      <rect x="540" y="318" width="84" height="104" rx="8" fill="${back1}"/>
      <path d="M548 362h68" stroke="${back2}" stroke-width="3"/>
      <circle cx="582" cy="390" r="4" fill="${back2}"/>
      <rect x="576" y="276" width="12" height="42" rx="3" fill="#2D2952"/>
      <ellipse cx="582" cy="318" rx="22" ry="5" fill="#2D2952"/>
      <path d="M556 282l10-46h32l10 46z" fill="#FFE3B8"/>

      <!-- headboard -->
      <rect x="66" y="188" width="440" height="200" rx="38" fill="url(#headboard)"/>
      <path d="M176 206v120M286 206v120M396 206v120" stroke="${card}" stroke-opacity=".08" stroke-width="4" stroke-linecap="round"/>

      <!-- pillows -->
      <rect x="98" y="250" width="180" height="76" rx="34" fill="url(#pillow)"/>
      <rect x="294" y="250" width="180" height="76" rx="34" fill="url(#pillow)"/>

      <!-- her: long hair fanned on the pillow -->
      <g transform="translate(0 -14) rotate(8 196 288)">
        <path d="M150 300c-22-36 2-80 46-78 44 2 62 40 44 78-10-8-18-10-26-8-20-6-42-4-64 8z" fill="#2B1E3F"/>
        <circle cx="196" cy="290" r="31" fill="url(#skinA)"/>
        <path d="M167 282c0-24 20-38 42-35 18 3 28 14 27 28-10-8-24-12-40-9-12 2-22 8-29 16z" fill="#2B1E3F"/>
        <path d="M181 296q6 4 12 0M203 296q6 4 12 0" stroke="#3A2230" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M197 302q2 2 4 0" stroke="#C98A6A" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="180" cy="306" rx="6" ry="4" fill="${a}" opacity=".22"/>
        <ellipse cx="216" cy="306" rx="6" ry="4" fill="${a}" opacity=".22"/>
      </g>

      <!-- him: short hair, ear -->
      <g transform="translate(0 -14) rotate(-8 378 288)">
        <circle cx="348" cy="296" r="8" fill="#8A5638"/>
        <circle cx="378" cy="290" r="33" fill="url(#skinB)"/>
        <path d="M346 282c-2-30 18-44 40-42 24 2 34 18 31 38-8-8-18-12-32-12-16 0-30 6-39 16z" fill="#18121F"/>
        <path d="M364 297q6 4 12 0M386 297q6 4 12 0" stroke="#2A1810" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M380 304q2 2 4 0" stroke="#6E4128" stroke-width="2" stroke-linecap="round"/>
      </g>

      <!-- blanket with folded-down sheet -->
      <path d="M40 326c80-20 170-14 248-12 80-2 168-8 238 12v98a22 22 0 0 1-22 22H62a22 22 0 0 1-22-22z" fill="url(#blanket)"/>
      <path d="M40 326c80-20 170-14 248-12 80-2 168-8 238 12v24c-70-16-158-10-238-8-78-2-168-8-248 8z" fill="${card}"/>
      <path d="M40 350c80-16 170-10 248-8 80-2 168-8 238 8" stroke="#C9C4DE" stroke-width="3"/>
      <path d="M120 386c40 10 70 30 84 58M452 384c-34 14-56 34-66 60M300 372c-6 24-4 48 4 72" stroke="${card}" stroke-opacity=".16" stroke-width="6" stroke-linecap="round"/>

      <!-- bed base + legs -->
      <rect x="52" y="438" width="462" height="20" rx="8" fill="${back2}"/>
      <rect x="70" y="456" width="14" height="16" rx="3" fill="${back2}"/>
      <rect x="482" y="456" width="14" height="16" rx="3" fill="${back2}"/>

      <!-- floor shadow -->
      <ellipse cx="320" cy="474" rx="300" ry="6" fill="#000" opacity=".22"/>
    </svg>`,
  // Long distance: a video call across time zones — her morning, his night — joined by a flight path.
  longdistance: ({ a, pop = a, card, back1, back2 }) => `
    <svg width="640" height="480" viewBox="0 0 640 480" fill="none">
      <defs>
        <linearGradient id="day" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#FFE8C6"/><stop offset="1" stop-color="#FFE8C6"/>
        </linearGradient>
        <linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4A4582"/><stop offset="1" stop-color="#4A4582"/>
        </linearGradient>
        <linearGradient id="ldSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="ldSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <clipPath id="screenL"><rect x="100" y="162" width="140" height="276" rx="22"/></clipPath>
        <clipPath id="screenR"><rect x="400" y="162" width="140" height="276" rx="22"/></clipPath>
        <mask id="ldMoon"><rect width="640" height="480" fill="#fff"/><circle cx="522" cy="226" r="12" fill="#000"/></mask>
      </defs>

      <!-- flight path + plane -->
      <path d="M176 146C250 38 390 38 464 146" stroke="${card}" stroke-opacity=".35" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 14"/>
      <g transform="translate(320 66) rotate(4)" fill="${pop}">
        <path d="M-28 0l48-5c8 0 12 2 12 5s-4 5-12 5z"/>
        <path d="M-2-2l-12-24h9l17 22zM-2 2l-12 24h9l17-22z"/>
        <path d="M-22-1l-7-12h6l8 11zM-22 1l-7 12h6l8-11z"/>
      </g>

      <!-- shadows -->
      <ellipse cx="170" cy="468" rx="78" ry="6" fill="#000" opacity=".25"/>
      <ellipse cx="470" cy="468" rx="78" ry="6" fill="#000" opacity=".25"/>

      <!-- her phone: morning -->
      <g transform="rotate(-6 170 300)">
        <rect x="90" y="150" width="160" height="300" rx="30" fill="#14112A"/>
        <g clip-path="url(#screenL)">
          <rect x="100" y="162" width="140" height="276" fill="url(#day)"/>
          <circle cx="212" cy="222" r="15" fill="#FFF6E6"/>
          <path d="M136 316c-4-38 16-50 36-50 22 0 40 14 36 50l2 50q-18 8-38 8t-38-8z" fill="#2B1E3F"/>
          <path d="M108 446c0-56 30-80 62-80s62 24 62 80z" fill="${a}"/>
          <rect x="160" y="340" width="20" height="30" rx="8" fill="#E8B08C"/>
          <circle cx="170" cy="318" r="33" fill="url(#ldSkinA)"/>
          <path d="M139 312c0-28 20-40 38-38 19 2 30 16 28 32-14-10-38-12-66 6z" fill="#2B1E3F"/>
          <circle cx="159" cy="322" r="3.4" fill="#3A2230"/>
          <circle cx="182" cy="322" r="3.4" fill="#3A2230"/>
          <path d="M162 335q8 7 16 0" stroke="#3A2230" stroke-width="2.6" stroke-linecap="round"/>
          <ellipse cx="151" cy="333" rx="6" ry="4" fill="${a}" opacity=".25"/>
          <ellipse cx="190" cy="333" rx="6" ry="4" fill="${a}" opacity=".25"/>
          <rect x="114" y="176" width="72" height="24" rx="12" fill="#FFFFFF" opacity=".75"/>
          <text x="150" y="193" text-anchor="middle" font-family="Inter" font-weight="600" font-size="13" fill="#1F1B3A">9:00 AM</text>
        </g>
        <rect x="146" y="168" width="48" height="8" rx="4" fill="#14112A"/>
      </g>

      <!-- his phone: night -->
      <g transform="rotate(6 470 300)">
        <rect x="390" y="150" width="160" height="300" rx="30" fill="#14112A"/>
        <g clip-path="url(#screenR)">
          <rect x="400" y="162" width="140" height="276" fill="url(#night)"/>
          <circle cx="512" cy="232" r="15" fill="#FFE7C4" mask="url(#ldMoon)"/>
          <path d="M408 446c0-56 30-80 62-80s62 24 62 80z" fill="${card}"/>
          <rect x="460" y="340" width="20" height="30" rx="8" fill="#8A5638"/>
          <circle cx="437" cy="322" r="7" fill="#8A5638"/>
          <circle cx="503" cy="322" r="7" fill="#8A5638"/>
          <circle cx="470" cy="318" r="33" fill="url(#ldSkinB)"/>
          <path d="M437 312c-4-30 14-46 35-46 24 0 37 16 34 40-9-10-22-14-36-14-14 0-26 8-33 20z" fill="#18121F"/>
          <circle cx="459" cy="322" r="3.4" fill="#2A1810"/>
          <circle cx="482" cy="322" r="3.4" fill="#2A1810"/>
          <path d="M462 335q8 7 16 0" stroke="#2A1810" stroke-width="2.6" stroke-linecap="round"/>
          <rect x="414" y="176" width="78" height="24" rx="12" fill="#FFFFFF" opacity=".16"/>
          <text x="453" y="193" text-anchor="middle" font-family="Inter" font-weight="600" font-size="13" fill="#FFFFFF">11:00 PM</text>
        </g>
        <rect x="446" y="168" width="48" height="8" rx="4" fill="#14112A"/>
      </g>
    </svg>`,
  // Acts of service: she's working on the couch, he brings her a coffee before she asks.
  service: ({ card }) => `
    <svg width="640" height="480" viewBox="0 0 640 480" fill="none">
      <defs>
        <linearGradient id="svSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="svSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <linearGradient id="couch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#C24A26"/><stop offset="1" stop-color="#C24A26"/>
        </linearGradient>
      </defs>

      <ellipse cx="320" cy="462" rx="290" ry="7" fill="#000" opacity=".18"/>

      <!-- couch -->
      <rect x="40" y="206" width="380" height="160" rx="44" fill="url(#couch)"/>
      <rect x="40" y="350" width="380" height="80" rx="26" fill="#A63B1A"/>
      <rect x="70" y="318" width="320" height="54" rx="22" fill="#D2593A"/>
      <rect x="20" y="276" width="72" height="154" rx="34" fill="#9A3516"/>
      <rect x="368" y="276" width="72" height="154" rx="34" fill="#9A3516"/>
      <rect x="62" y="428" width="14" height="24" rx="4" fill="#7A2A10"/>
      <rect x="384" y="428" width="14" height="24" rx="4" fill="#7A2A10"/>
      <rect x="96" y="244" width="84" height="78" rx="24" fill="#FFD9CC" transform="rotate(-10 138 283)"/>

      <!-- her -->
      <circle cx="204" cy="190" r="17" fill="#2B1E3F"/>
      <path d="M186 342c-2-62 14-92 46-92s48 30 46 92z" fill="#FFE7A0"/>
      <rect x="222" y="232" width="20" height="26" rx="8" fill="#E8B08C"/>
      <circle cx="232" cy="212" r="30" fill="url(#svSkinA)"/>
      <path d="M203 208c-2-28 16-42 34-41 20 1 31 14 30 32-12-12-36-14-64 9z" fill="#2B1E3F"/>
      <circle cx="232" cy="215" r="3.2" fill="#3A2230"/>
      <circle cx="251" cy="212" r="3.2" fill="#3A2230"/>
      <path d="M236 228q8 6 15-1" stroke="#3A2230" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="224" cy="226" rx="6" ry="4" fill="#EE633C" opacity=".25"/>
      <rect x="208" y="320" width="126" height="36" rx="18" fill="#2D3A6B"/>
      <rect x="306" y="326" width="32" height="94" rx="15" fill="#2D3A6B"/>
      <ellipse cx="332" cy="424" rx="24" ry="10" fill="${card}"/>
      <path d="M220 320l12-50h70l-10 50z" fill="#E4E4EC"/>
      <rect x="212" y="316" width="104" height="9" rx="4" fill="#C9C9D6"/>
      <path d="M250 280c26-12 52-18 82-22" stroke="#EDB894" stroke-width="17" stroke-linecap="round"/>

      <!-- him, handing over the mug -->
      <rect x="444" y="330" width="26" height="124" rx="12" fill="#1F2A55"/>
      <rect x="474" y="330" width="26" height="124" rx="12" fill="#1F2A55"/>
      <ellipse cx="453" cy="456" rx="22" ry="9" fill="#1A1426"/>
      <ellipse cx="493" cy="456" rx="22" ry="9" fill="#1A1426"/>
      <path d="M432 346c-2-74 14-110 40-110s42 36 40 110z" fill="${card}"/>
      <path d="M494 280c8 18 12 38 12 60" stroke="url(#svSkinB)" stroke-width="18" stroke-linecap="round"/>
      <rect x="462" y="218" width="20" height="26" rx="8" fill="#8A5638"/>
      <circle cx="442" cy="200" r="7" fill="#8A5638"/>
      <circle cx="472" cy="196" r="31" fill="url(#svSkinB)"/>
      <path d="M441 190c-2-28 14-42 34-42 22 0 34 14 31 36-8-10-20-14-33-14s-25 8-32 20z" fill="#18121F"/>
      <circle cx="458" cy="200" r="3.2" fill="#2A1810"/>
      <circle cx="477" cy="199" r="3.2" fill="#2A1810"/>
      <path d="M458 213q8 6 15 0" stroke="#2A1810" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M458 274c-30-10-58-16-88-20" stroke="#93603F" stroke-width="18" stroke-linecap="round"/>

      <!-- mug -->
      <path d="M346 210q-8-10 0-20t0-20M362 210q-8-10 0-20t0-20" stroke="${card}" stroke-opacity=".75" stroke-width="4" stroke-linecap="round"/>
      <path d="M378 232q16 0 16 13t-16 13" stroke="${card}" stroke-width="6"/>
      <rect x="340" y="222" width="40" height="44" rx="8" fill="${card}"/>
      <ellipse cx="360" cy="225" rx="16" ry="4" fill="#6B3A22"/>
      <circle cx="372" cy="254" r="10" fill="#8A5638"/>
    </svg>`,
  // This or That: the couple holding up "A" and "B" voting paddles, game-show style.
  thisorthat: ({ card, back2 }) => `
    <svg width="640" height="480" viewBox="0 0 640 480" fill="none">
      <defs>
        <linearGradient id="tSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="tSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <linearGradient id="tFadeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#fff"/>
        </linearGradient>
        <mask id="tFade"><rect width="640" height="480" fill="url(#tFadeG)"/></mask>
      </defs>
      <g mask="url(#tFade)">

      <!-- her paddle -->
      <path d="M128 200v110" stroke="#3E2F9E" stroke-width="10" stroke-linecap="round"/>
      <circle cx="128" cy="140" r="62" fill="${card}"/>
      <text x="128" y="164" text-anchor="middle" font-family="Serif" font-size="72" fill="${back2}">A</text>

      <!-- her -->
      <path d="M176 330c-8-50 6-104 48-104s58 54 48 104z" fill="#2B1E3F"/>
      <rect x="212" y="300" width="24" height="56" rx="10" fill="#E8B08C"/>
        <path d="M150 472c-2-112 26-160 74-160s76 48 74 160z" fill="#FFE7A0"/>
        <path d="M211 314q13 15 26 0z" fill="#E8B08C"/>
      
      <path d="M168 380c-22-20-36-50-40-78" stroke="url(#tSkinA)" stroke-width="20" stroke-linecap="round"/>
      <circle cx="128" cy="300" r="13" fill="#EDB894"/>
      <circle cx="224" cy="270" r="38" fill="url(#tSkinA)"/>
      <path d="M187 266c-2-34 20-52 42-50 24 2 36 18 34 40-14-14-44-18-76 10z" fill="#2B1E3F"/>
      <circle cx="210" cy="274" r="3.6" fill="#3A2230"/>
      <circle cx="236" cy="274" r="3.6" fill="#3A2230"/>
      <path d="M212 288q11 12 22 0z" fill="#3A2230"/>
      <ellipse cx="200" cy="288" rx="7" ry="4.5" fill="#FF4D6D" opacity=".25"/>
      <ellipse cx="248" cy="288" rx="7" ry="4.5" fill="#FF4D6D" opacity=".25"/>

      <!-- his paddle -->
      <path d="M512 200v110" stroke="#3E2F9E" stroke-width="10" stroke-linecap="round"/>
      <circle cx="512" cy="140" r="62" fill="${card}"/>
      <text x="512" y="164" text-anchor="middle" font-family="Serif" font-size="72" fill="${back2}">B</text>

      <!-- him -->
      <rect x="408" y="292" width="24" height="60" rx="10" fill="#8A5638"/>
        <path d="M342 472c-2-120 28-168 78-168s80 48 78 168z" fill="#3E2F9E"/>
        <path d="M407 306q13 15 26 0z" fill="#8A5638"/>
      <path d="M398 308l22 26 22-26" stroke="#2C2178" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      
      <path d="M472 380c22-20 36-50 40-78" stroke="url(#tSkinB)" stroke-width="20" stroke-linecap="round"/>
      <circle cx="512" cy="300" r="13" fill="#93603F"/>
      <circle cx="382" cy="266" r="8" fill="#8A5638"/>
      <circle cx="458" cy="266" r="8" fill="#8A5638"/>
      <circle cx="420" cy="262" r="38" fill="url(#tSkinB)"/>
      <path d="M383 254c-4-34 16-52 39-52 26 0 40 18 36 46-10-12-22-16-38-16-14 0-28 8-37 22z" fill="#18121F"/>
      <circle cx="408" cy="268" r="3.6" fill="#2A1810"/>
      <circle cx="432" cy="268" r="3.6" fill="#2A1810"/>
      <path d="M410 282q10 9 20 0" stroke="#2A1810" stroke-width="3" stroke-linecap="round"/>
      </g>
    </svg>`,
  // Cozy dates: wrapped in one blanket in front of a blanket fort, under string lights.
  cozy: ({ card }) => `
    <svg width="640" height="480" viewBox="0 0 640 480" fill="none">
      <defs>
        <linearGradient id="czSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="czSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <radialGradient id="czGlow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="#FFE7A0"/><stop offset="1" stop-color="#FFE7A0"/>
        </radialGradient>
      </defs>

      <!-- string lights -->
      <path d="M20 60Q320 140 620 60" stroke="#1A1A1A" stroke-width="3"/>
      <rect x="77" y="72" width="6" height="8" rx="2" fill="#1A1A1A"/><circle cx="80" cy="86" r="9" fill="#FFD93D"/>
      <rect x="137" y="84" width="6" height="8" rx="2" fill="#1A1A1A"/><circle cx="140" cy="98" r="9" fill="#FFD93D"/>
      <rect x="197" y="92" width="6" height="8" rx="2" fill="#1A1A1A"/><circle cx="200" cy="106" r="9" fill="#FFD93D"/>
      <rect x="257" y="96" width="6" height="8" rx="2" fill="#1A1A1A"/><circle cx="260" cy="110" r="9" fill="#FFD93D"/>
      <rect x="317" y="98" width="6" height="8" rx="2" fill="#1A1A1A"/><circle cx="320" cy="112" r="9" fill="#FFD93D"/>
      <rect x="377" y="96" width="6" height="8" rx="2" fill="#1A1A1A"/><circle cx="380" cy="110" r="9" fill="#FFD93D"/>
      <rect x="437" y="92" width="6" height="8" rx="2" fill="#1A1A1A"/><circle cx="440" cy="106" r="9" fill="#FFD93D"/>
      <rect x="497" y="84" width="6" height="8" rx="2" fill="#1A1A1A"/><circle cx="500" cy="98" r="9" fill="#FFD93D"/>
      <rect x="557" y="72" width="6" height="8" rx="2" fill="#1A1A1A"/><circle cx="560" cy="86" r="9" fill="#FFD93D"/>

      <!-- rug -->
      <ellipse cx="320" cy="436" rx="290" ry="30" fill="#FFD9CC"/>

      <!-- blanket fort -->
      <path d="M60 420L184 150l124 270z" fill="#FF4D6D"/>
      <path d="M184 150l-40 270h80z" fill="url(#czGlow)"/>
      <path d="M184 150l-12 270M184 150l14 270" stroke="#D93556" stroke-opacity=".35" stroke-width="3"/>
      <path d="M170 128l26 40M198 128l-26 40" stroke="#1A1A1A" stroke-width="5" stroke-linecap="round"/>

      <!-- the two of them under one blanket -->
      <circle cx="398" cy="226" r="16" fill="#2B1E3F"/>
      <g transform="rotate(8 420 258)">
        <circle cx="420" cy="258" r="32" fill="url(#czSkinA)"/>
        <path d="M389 254c-2-28 18-42 36-41 20 1 31 14 30 32-12-12-36-14-66 9z" fill="#2B1E3F"/>
        <path d="M407 263q5 4 10 0M427 263q5 4 10 0" stroke="#3A2230" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M413 276q7 5 13 0" stroke="#3A2230" stroke-width="2.4" stroke-linecap="round"/>
        <ellipse cx="402" cy="272" rx="6" ry="4" fill="#FF4D6D" opacity=".25"/>
      </g>
      <g transform="rotate(-8 492 254)">
        <circle cx="462" cy="258" r="7" fill="#8A5638"/>
        <circle cx="492" cy="254" r="33" fill="url(#czSkinB)"/>
        <path d="M459 248c-2-30 16-44 36-44 22 0 34 16 31 38-8-10-20-14-33-14s-26 8-34 20z" fill="#18121F"/>
        <path d="M478 260q5 4 10 0M498 260q5 4 10 0" stroke="#2A1810" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M485 272q7 5 13 0" stroke="#2A1810" stroke-width="2.4" stroke-linecap="round"/>
      </g>
      <clipPath id="czBlanket"><path d="M332 428c-2-86 26-130 74-140 30-6 70-6 100 0 48 10 76 54 74 140z"/></clipPath>
      <path d="M332 428c-2-86 26-130 74-140 30-6 70-6 100 0 48 10 76 54 74 140z" fill="#FFE7A0"/>
      <g clip-path="url(#czBlanket)" stroke="#FF8A65" stroke-opacity=".45" stroke-width="12">
        <path d="M320 372c80-10 180-10 270 0M320 404c80-10 180-10 270 0"/>
      </g>
      <path d="M456 296c-6 40-4 90 6 132" stroke="#E8C66E" stroke-width="4" stroke-linecap="round"/>

      <!-- mugs -->
      <path d="M432 330q14 0 14 11t-14 11" stroke="#FF4D6D" stroke-width="5"/>
      <rect x="398" y="318" width="36" height="40" rx="7" fill="#FF4D6D"/>
      <rect x="398" y="330" width="36" height="8" fill="${card}"/>
      <circle cx="396" cy="344" r="9" fill="#EDB894"/>
      <path d="M540 330q14 0 14 11t-14 11" stroke="#FF4D6D" stroke-width="5"/>
      <rect x="506" y="318" width="36" height="40" rx="7" fill="#FF4D6D"/>
      <rect x="506" y="330" width="36" height="8" fill="${card}"/>
      <circle cx="504" cy="344" r="9" fill="#93603F"/>
    </svg>`,
  // Habits: brushing teeth side by side at the bathroom mirror — the smallest daily ritual.
  habits: ({ card }) => `
    <svg width="640" height="480" viewBox="0 0 640 480" fill="none">
      <defs>
        <linearGradient id="hbSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="hbSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
      </defs>

      <!-- mirror -->
      <path d="M140 300V160a180 130 0 0 1 360 0v140z" fill="#DCEBFF" stroke="${card}" stroke-width="14"/>
      <path d="M200 120l60-60M228 150l80-80" stroke="${card}" stroke-opacity=".7" stroke-width="10" stroke-linecap="round"/>

      <!-- her: bun, side glance, blue brush -->
      <circle cx="234" cy="196" r="18" fill="#2B1E3F"/>
      <path d="M180 400c-2-76 24-120 70-120s72 44 70 120z" fill="#8EC5FF"/>
      <rect x="238" y="262" width="24" height="30" rx="10" fill="#E8B08C"/>
      <circle cx="250" cy="240" r="36" fill="url(#hbSkinA)"/>
      <path d="M215 236c-2-30 20-46 40-45 22 1 34 16 33 36-14-14-40-16-73 9z" fill="#2B1E3F"/>
      <circle cx="244" cy="242" r="3.6" fill="#3A2230"/>
      <circle cx="266" cy="242" r="3.6" fill="#3A2230"/>
      <ellipse cx="256" cy="262" rx="9" ry="6" fill="${card}"/>
      <circle cx="248" cy="262" r="4" fill="${card}"/><circle cx="264" cy="260" r="3.5" fill="${card}"/>
      <path d="M262 262l40 26" stroke="#2E5BFF" stroke-width="8" stroke-linecap="round"/>
      <path d="M318 340c-6-20-12-36-20-48" stroke="url(#hbSkinA)" stroke-width="18" stroke-linecap="round"/>
      <circle cx="300" cy="290" r="11" fill="#EDB894"/>
      <ellipse cx="232" cy="256" rx="6" ry="4" fill="#FF4D6D" opacity=".25"/>

      <!-- him: sleepy eyes, pink brush -->
      <path d="M322 400c-2-76 26-122 74-122s76 46 74 122z" fill="#FF9EC4"/>
      <rect x="384" y="258" width="24" height="32" rx="10" fill="#8A5638"/>
      <circle cx="361" cy="238" r="7" fill="#8A5638"/>
      <circle cx="431" cy="238" r="7" fill="#8A5638"/>
      <circle cx="396" cy="234" r="36" fill="url(#hbSkinB)"/>
      <path d="M360 226c-4-32 16-48 38-48 24 0 38 16 34 42-10-12-22-16-36-16s-28 8-36 22z" fill="#18121F"/>
      <path d="M380 238h10M402 238h10" stroke="#2A1810" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="396" cy="256" rx="9" ry="6" fill="${card}"/>
      <circle cx="406" cy="254" r="4" fill="${card}"/>
      <path d="M402 256l40 22" stroke="#FF4D6D" stroke-width="8" stroke-linecap="round"/>
      <path d="M470 340c-4-22-12-40-24-56" stroke="url(#hbSkinB)" stroke-width="18" stroke-linecap="round"/>
      <circle cx="444" cy="280" r="11" fill="#93603F"/>

      <!-- counter + sink -->
      <rect x="80" y="372" width="480" height="96" rx="18" fill="${card}"/>
      <rect x="80" y="372" width="480" height="18" rx="9" fill="#EDEAF2"/>
      <ellipse cx="320" cy="384" rx="74" ry="11" fill="#DCEBFF"/>
      <path d="M320 384v-30h26" stroke="#C9C9D6" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="130" y="332" width="34" height="44" rx="8" fill="#8EC5FF"/>
      <rect x="480" y="340" width="26" height="36" rx="8" fill="#FF9EC4"/>
    </svg>`,
  // Exhausted: both collapsed on the sofa, heads together, eyes shut, takeout on the table.
  exhausted: ({ card }) => `
    <svg width="640" height="480" viewBox="0 0 640 480" fill="none">
      <defs>
        <linearGradient id="exSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="exSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
      </defs>
      <ellipse cx="320" cy="476" rx="290" ry="5" fill="#000" opacity=".15"/>

      <!-- sofa -->
      <rect x="70" y="196" width="500" height="156" rx="44" fill="#3D3870"/>
      <rect x="70" y="340" width="500" height="82" rx="26" fill="#2D2952"/>
      <rect x="104" y="304" width="432" height="54" rx="22" fill="#4A4582"/>
      <rect x="48" y="262" width="74" height="160" rx="34" fill="#2D2952"/>
      <rect x="518" y="262" width="74" height="160" rx="34" fill="#2D2952"/>
      <rect x="90" y="420" width="14" height="24" rx="4" fill="#1F1B3A"/>
      <rect x="536" y="420" width="14" height="24" rx="4" fill="#1F1B3A"/>

      <!-- her: slumped, head on his shoulder -->
      <path d="M218 358c-2-64 16-96 56-96s56 32 54 96z" fill="${card}"/>
      <g transform="rotate(16 292 242)">
        <path d="M256 262c-10-44 6-72 38-72s48 28 38 72z" fill="#2B1E3F"/>
        <circle cx="292" cy="242" r="31" fill="url(#exSkinA)"/>
        <path d="M262 238c-2-28 18-42 36-41 20 1 31 14 30 32-12-12-36-14-66 9z" fill="#2B1E3F"/>
        <path d="M278 248q5 4 10 0M298 248q5 4 10 0" stroke="#3A2230" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse cx="294" cy="262" rx="4" ry="3" fill="#3A2230"/>
      </g>

      <!-- him: head tipped back onto hers -->
      <path d="M318 360c-2-70 18-104 62-104s62 34 60 104z" fill="#FFE7A0"/>
      <g transform="rotate(-12 372 226)">
        <circle cx="403" cy="230" r="7" fill="#8A5638"/>
        <circle cx="372" cy="226" r="33" fill="url(#exSkinB)"/>
        <path d="M339 218c-2-30 16-44 36-44 22 0 34 16 31 38-8-10-20-14-33-14s-26 8-34 20z" fill="#18121F"/>
        <path d="M356 232q5 4 10 0M376 232q5 4 10 0" stroke="#2A1810" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M364 246q6 3 12 0" stroke="#2A1810" stroke-width="2.4" stroke-linecap="round"/>
      </g>

      <!-- coffee table + takeout, in front of the sofa -->
      <rect x="150" y="440" width="340" height="18" rx="9" fill="#1F1B3A"/>
      <rect x="174" y="456" width="12" height="22" rx="4" fill="#1F1B3A"/>
      <rect x="454" y="456" width="12" height="22" rx="4" fill="#1F1B3A"/>
      <path d="M216 440l-10-52h64l-10 52z" fill="${card}"/>
      <path d="M210 408h56" stroke="#FF4D6D" stroke-width="8"/>
      <path d="M220 388l-6-10h48l-6 10" fill="#EDEAF2"/>
      <path d="M252 388l24-48M262 388l26-44" stroke="#B5763F" stroke-width="5" stroke-linecap="round"/>
      <rect x="370" y="428" width="62" height="14" rx="7" fill="#2D2952"/>
      <circle cx="414" cy="435" r="3.5" fill="#FF4D6D"/>
    </svg>`,
  // Falling in love again: slow-dancing in the kitchen under the pendant light.
  dance: ({ a, card, back1, back2 }) => `
    <svg width="640" height="480" viewBox="0 0 640 480" fill="none">
      <defs>
        <linearGradient id="dnSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="dnSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <radialGradient id="dnGlow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="#FFD9A0" stop-opacity=".5"/><stop offset="1" stop-color="#FFD9A0" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <!-- pendant light -->
      <circle cx="320" cy="132" r="124" fill="url(#dnGlow)"/>
      <path d="M320 0v48" stroke="${back1}" stroke-width="4"/>
      <path d="M288 84l12-36h40l12 36z" fill="#FFE3B8"/>

      <!-- kitchen counter behind -->
      <rect x="40" y="300" width="560" height="150" rx="14" fill="${back2}"/>
      <rect x="40" y="300" width="560" height="20" rx="10" fill="${back1}"/>
      <path d="M180 336v100M320 336v100M460 336v100" stroke="${back1}" stroke-width="4"/>
      <circle cx="166" cy="386" r="5" fill="${back1}"/><circle cx="194" cy="386" r="5" fill="${back1}"/>
      <circle cx="446" cy="386" r="5" fill="${back1}"/><circle cx="474" cy="386" r="5" fill="${back1}"/>
      <rect x="500" y="262" width="40" height="40" rx="8" fill="${card}"/><path d="M520 262v-16" stroke="#7BC59A" stroke-width="10" stroke-linecap="round"/>
      <ellipse cx="320" cy="470" rx="170" ry="7" fill="#000" opacity=".3"/>

      <!-- her: twirling, dress flaring -->
      <path d="M248 156c-4 14-14 40-34 52" stroke="#2B1E3F" stroke-width="16" stroke-linecap="round"/>
      <path d="M244 366l-6 90M266 366l8 90" stroke="url(#dnSkinA)" stroke-width="15" stroke-linecap="round"/>
      <ellipse cx="236" cy="460" rx="14" ry="6" fill="${card}"/><ellipse cx="276" cy="460" rx="14" ry="6" fill="${card}"/>
      <path d="M232 204c-4 30-2 56 6 76-28 30-44 60-48 92 40 10 92 10 132 0-6-34-24-64-50-92 8-22 8-48 2-76z" fill="${a}"/>
      <path d="M268 214c22-30 36-60 48-92" stroke="url(#dnSkinA)" stroke-width="14" stroke-linecap="round"/>
      <path d="M236 220c-16 20-18 40-10 54" stroke="url(#dnSkinA)" stroke-width="14" stroke-linecap="round"/>
      <rect x="242" y="182" width="18" height="26" rx="7" fill="#E8B08C"/>
      <circle cx="252" cy="160" r="28" fill="url(#dnSkinA)"/>
      <path d="M225 156c-2-24 16-38 32-37 18 1 28 12 27 28-12-10-32-12-59 9z" fill="#2B1E3F"/>
      <path d="M254 162q5 4 10 0" stroke="#3A2230" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M260 175q6 5 12 0" stroke="#3A2230" stroke-width="2.4" stroke-linecap="round"/>
      <ellipse cx="270" cy="170" rx="5" ry="3.5" fill="${a}" opacity=".3"/>

      <!-- him: leading, arm around her waist -->
      <path d="M368 300l-10 156M392 300l10 156" stroke="#1F2A55" stroke-width="22" stroke-linecap="round"/>
      <ellipse cx="354" cy="460" rx="18" ry="7" fill="#14112A"/><ellipse cx="406" cy="460" rx="18" ry="7" fill="#14112A"/>
      <path d="M346 312c-6-70 4-120 34-120s42 50 34 120z" fill="#FFE7A0"/>
      <path d="M356 210c-14-26-26-56-34-86" stroke="url(#dnSkinB)" stroke-width="15" stroke-linecap="round"/>
      <circle cx="318" cy="118" r="11" fill="#93603F"/>
      <circle cx="314" cy="124" r="9" fill="#EDB894"/>
      <path d="M354 236c-26 14-50 22-76 26" stroke="url(#dnSkinB)" stroke-width="15" stroke-linecap="round"/>
      <rect x="370" y="168" width="20" height="28" rx="8" fill="#8A5638"/>
      <circle cx="404" cy="150" r="7" fill="#8A5638"/>
      <circle cx="380" cy="146" r="30" fill="url(#dnSkinB)"/>
      <path d="M350 140c-2-28 14-42 33-42 22 0 33 15 30 36-8-10-19-14-31-14s-24 8-32 20z" fill="#18121F"/>
      <path d="M362 150q5 4 10 0" stroke="#2A1810" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M362 163q6 5 12 0" stroke="#2A1810" stroke-width="2.4" stroke-linecap="round"/>
    </svg>`,
  // Long-distance date: a split-screen dinner — her sunny kitchen, his night-time room — candles lit on both sides.
  ldrdinner: ({ a, card }) => `
    <svg width="640" height="480" viewBox="0 0 640 480" fill="none">
      <defs>
        <linearGradient id="ldSkinA2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="ldSkinB2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <clipPath id="panelL"><rect x="30" y="60" width="280" height="390" rx="32"/></clipPath>
        <clipPath id="panelR"><rect x="330" y="60" width="280" height="390" rx="32"/></clipPath>
        <mask id="ldMoon2"><rect width="640" height="480" fill="#fff"/><circle cx="548" cy="112" r="16" fill="#000"/></mask>
      </defs>

      <!-- her side: daytime -->
      <g clip-path="url(#panelL)">
        <rect x="30" y="60" width="280" height="390" fill="#FFD9CC"/>
        <rect x="70" y="96" width="110" height="96" rx="10" fill="#FFF4EA"/>
        <circle cx="146" cy="128" r="16" fill="#FFD93D"/>
        <path d="M125 96v96M70 144h110" stroke="#FFD9CC" stroke-width="6"/>
        <path d="M132 316c-8-46 4-96 40-96s48 50 40 96z" fill="#2B1E3F"/>
        <rect x="160" y="288" width="24" height="52" rx="10" fill="#E8B08C"/>
        <path d="M100 450c-2-106 26-150 72-150s74 44 72 150z" fill="#8EC5FF"/>
        <path d="M159 302q13 15 26 0z" fill="#E8B08C"/>
        
        <circle cx="172" cy="264" r="34" fill="url(#ldSkinA2)"/>
        <path d="M139 260c-2-30 18-46 38-45 22 1 34 16 33 36-14-14-40-16-71 9z" fill="#2B1E3F"/>
        <circle cx="160" cy="268" r="3.4" fill="#3A2230"/><circle cx="182" cy="268" r="3.4" fill="#3A2230"/>
        <path d="M162 282q9 8 18 0" stroke="#3A2230" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse cx="150" cy="280" rx="6" ry="4" fill="${a}" opacity=".25"/>
        <rect x="30" y="384" width="280" height="66" fill="${card}"/>
        <ellipse cx="172" cy="388" rx="60" ry="12" fill="#F0EEF5"/>
        <path d="M140 386c10-12 24-12 32-2 8-10 22-10 30 2" stroke="#FFC861" stroke-width="10" stroke-linecap="round"/>
        <rect x="262" y="330" width="14" height="56" rx="4" fill="#FFFBF4"/>
        <path d="M269 306c8 8 8 18 0 22-8-4-8-14 0-22z" fill="#FFB020"/>
      </g>

      <!-- his side: night -->
      <g clip-path="url(#panelR)">
        <rect x="330" y="60" width="280" height="390" fill="#3D3870"/>
        <rect x="480" y="90" width="100" height="90" rx="10" fill="#2D2952"/>
        <circle cx="538" cy="120" r="18" fill="#FFE7C4" mask="url(#ldMoon2)"/>
        <rect x="462" y="286" width="24" height="52" rx="10" fill="#8A5638"/>
        <path d="M400 450c-2-108 28-152 74-152s76 44 74 152z" fill="${card}"/>
        <path d="M461 300q13 15 26 0z" fill="#8A5638"/>
        
        <circle cx="439" cy="264" r="7" fill="#8A5638"/><circle cx="509" cy="264" r="7" fill="#8A5638"/>
        <circle cx="474" cy="260" r="35" fill="url(#ldSkinB2)"/>
        <path d="M439 252c-4-32 16-48 37-48 24 0 37 16 34 42-10-12-22-16-36-16s-27 8-35 22z" fill="#18121F"/>
        <circle cx="462" cy="266" r="3.4" fill="#2A1810"/><circle cx="485" cy="266" r="3.4" fill="#2A1810"/>
        <path d="M464 280q9 8 18 0" stroke="#2A1810" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="330" y="384" width="280" height="66" fill="#2D2952"/>
        <ellipse cx="474" cy="388" rx="60" ry="12" fill="#F0EEF5"/>
        <path d="M442 386c10-12 24-12 32-2 8-10 22-10 30 2" stroke="#FFC861" stroke-width="10" stroke-linecap="round"/>
        <rect x="364" y="330" width="14" height="56" rx="4" fill="#FFFBF4"/>
        <path d="M371 306c8 8 8 18 0 22-8-4-8-14 0-22z" fill="#FFB020"/>
      </g>
    </svg>`,
  // Best friends: laughing together, sharing one pair of wired earphones — the wires make a heart.
  bestfriends: ({ card }) => `
    <svg width="560" height="402" viewBox="90 150 460 330" fill="none">
      <defs>
        <linearGradient id="bfSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="bfSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <linearGradient id="bfFadeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#fff"/>
        </linearGradient>
        <mask id="bfFade"><rect width="640" height="480" fill="url(#bfFadeG)"/></mask>
      </defs>
      <g mask="url(#bfFade)">
        <!-- her -->
        <path d="M196 300c-10-60 6-120 52-120s62 60 52 120z" fill="#2B1E3F"/>
        <rect x="232" y="294" width="24" height="56" rx="10" fill="#E8B08C"/>
        <path d="M150 480c-2-130 30-182 94-182s96 52 94 182z" fill="#FFE7A0"/>
        <path d="M231 300q13 15 26 0z" fill="#E8B08C"/>
        
        <g transform="rotate(10 244 250)">
          <circle cx="244" cy="250" r="44" fill="url(#bfSkinA)"/>
          <path d="M200 244c-2-36 24-56 48-54 26 2 40 20 38 44-16-16-48-20-86 10z" fill="#2B1E3F"/>
          <path d="M224 252q7-7 14 0M252 252q7-7 14 0" stroke="#3A2230" stroke-width="3.4" stroke-linecap="round"/>
          <path d="M230 270q15 18 30 0z" fill="#3A2230"/>
          <ellipse cx="220" cy="270" rx="8" ry="5" fill="#FF4D6D" opacity=".28"/>
          <ellipse cx="272" cy="268" rx="8" ry="5" fill="#FF4D6D" opacity=".28"/>
          <circle cx="288" cy="256" r="9" fill="${card}"/>
        </g>

        <!-- him -->
        <rect x="386" y="290" width="26" height="58" rx="10" fill="#8A5638"/>
        <path d="M304 480c-2-134 32-186 96-186s98 52 96 186z" fill="${card}"/>
        <path d="M386 296q13 15 26 0z" fill="#8A5638"/>
        
        <g transform="rotate(-10 398 244)">
          <circle cx="442" cy="250" r="9" fill="#8A5638"/>
          <circle cx="398" cy="244" r="45" fill="url(#bfSkinB)"/>
          <path d="M354 234c-4-38 20-58 46-58 30 0 46 20 42 52-12-16-28-20-46-20s-32 10-42 26z" fill="#18121F"/>
          <path d="M376 246q7-7 14 0M404 246q7-7 14 0" stroke="#2A1810" stroke-width="3.4" stroke-linecap="round"/>
          <path d="M382 264q15 18 30 0z" fill="#2A1810"/>
          <circle cx="354" cy="252" r="9" fill="${card}"/>
        </g>

        <!-- shared earphones: the two wires meet in a heart, then run to his phone -->
        <path d="M290 266C250 316 282 352 320 384M352 262C392 312 358 350 320 384" stroke="${card}" stroke-width="5" stroke-linecap="round"/>
        <path d="M320 384c30 6 66-4 100-38" stroke="${card}" stroke-width="5" stroke-linecap="round"/>
        <rect x="420" y="320" width="28" height="42" rx="6" fill="#1F1B3A"/>
        <rect x="412" y="334" width="44" height="40" rx="6" fill="#EADCC9"/>
      </g>
    </svg>`,
  // Would you rather: a card game at a low table — she fans her cards, he holds up a "?" card, both laughing.
  cardgame: ({ card, back1, back2 }) => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>
        <linearGradient id="cgSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="cgSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
      </defs>
      <ellipse cx="320" cy="470" rx="250" ry="7" fill="#000" opacity=".2"/>

      <!-- her -->
      <path d="M170 300c-10-60 6-116 50-116s60 56 50 116z" fill="#2B1E3F"/>
      <path d="M134 400c-2-70 30-110 86-110s88 40 86 110z" fill="#FF9EC4"/>
      <rect x="208" y="262" width="24" height="34" rx="10" fill="#E8B08C"/>
      <circle cx="220" cy="236" r="38" fill="url(#cgSkinA)"/>
      <path d="M182 232c-2-32 22-50 44-48 24 2 38 18 36 40-14-14-46-18-80 8z" fill="#2B1E3F"/>
      <path d="M200 240q6-6 12 0M226 240q6-6 12 0" stroke="#3A2230" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M208 256q12 14 24 0z" fill="#3A2230"/>
      <ellipse cx="198" cy="254" rx="7" ry="4.5" fill="#FF4D6D" opacity=".28"/>
      <ellipse cx="244" cy="254" rx="7" ry="4.5" fill="#FF4D6D" opacity=".28"/>
      <g transform="translate(236 340)">
        <rect x="-26" y="-78" width="52" height="76" rx="7" fill="#FFD93D" stroke="${card}" stroke-width="4" transform="rotate(-24)"/>
        <rect x="-26" y="-82" width="52" height="76" rx="7" fill="#88E3B5" stroke="${card}" stroke-width="4"/>
        <rect x="-26" y="-78" width="52" height="76" rx="7" fill="#FFB38A" stroke="${card}" stroke-width="4" transform="rotate(24)"/>
      </g>
      <circle cx="236" cy="338" r="13" fill="#EDB894"/>

      <!-- him, holding up the question card -->
      <path d="M332 400c-2-72 30-112 88-112s90 40 88 112z" fill="#FFD93D"/>
      <rect x="408" y="258" width="26" height="36" rx="10" fill="#8A5638"/>
      <circle cx="384" cy="232" r="8" fill="#8A5638"/><circle cx="458" cy="232" r="8" fill="#8A5638"/>
      <circle cx="421" cy="230" r="38" fill="url(#cgSkinB)"/>
      <path d="M384 222c-4-34 18-52 40-52 26 0 40 18 36 46-10-12-22-16-38-16s-28 8-38 22z" fill="#18121F"/>
      <path d="M402 232q6-6 12 0M428 232q6-6 12 0" stroke="#2A1810" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M408 248q13 15 26 0z" fill="#2A1810"/>
      <path d="M492 360c10-40 12-80 6-116" stroke="url(#cgSkinB)" stroke-width="18" stroke-linecap="round"/>
      <g transform="rotate(10 506 196)">
        <rect x="470" y="140" width="76" height="108" rx="10" fill="${card}"/>
        <text x="508" y="214" text-anchor="middle" font-family="Serif" font-size="70" fill="#FF4D6D">?</text>
      </g>
      <circle cx="498" cy="246" r="13" fill="#93603F"/>

      <!-- low table with the deck -->
      <rect x="100" y="388" width="440" height="26" rx="13" fill="${back2}"/>
      <rect x="130" y="412" width="14" height="44" rx="5" fill="${back2}"/>
      <rect x="496" y="412" width="14" height="44" rx="5" fill="${back2}"/>
      <rect x="292" y="370" width="56" height="20" rx="5" fill="#C3B1FF"/>
      <rect x="296" y="362" width="56" height="20" rx="5" fill="#8EC5FF"/>
      <rect x="290" y="354" width="56" height="20" rx="5" fill="${card}"/>
      <rect x="160" y="378" width="54" height="14" rx="4" fill="#FF9EC4" transform="rotate(-8 187 385)"/>
      <rect x="430" y="378" width="54" height="14" rx="4" fill="#88E3B5" transform="rotate(10 457 385)"/>
    </svg>`,
  // Truth or dare: she holds up a DARE card with a grin; he hides behind his hands, peeking.
  truthdare: ({ card }) => `
    <svg width="560" height="384" viewBox="70 120 500 343" fill="none">
      <defs>
        <linearGradient id="tdSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="tdSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <linearGradient id="tdFadeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#fff"/>
        </linearGradient>
        <mask id="tdFade"><rect x="0" y="0" width="640" height="480" fill="url(#tdFadeG)"/></mask>
      </defs>
      <g mask="url(#tdFade)">
        <!-- her: mischievous grin, DARE card up -->
        <path d="M168 300c-10-60 6-116 50-116s60 56 50 116z" fill="#2B1E3F"/>
        <rect x="206" y="270" width="24" height="76" rx="10" fill="#E8B08C"/>
        <path d="M130 470c-2-128 30-178 88-178s90 50 88 178z" fill="#FFE7A0"/>
        <path d="M205 294q13 15 26 0z" fill="#E8B08C"/>
        
        <circle cx="218" cy="242" r="40" fill="url(#tdSkinA)"/>
        <path d="M178 238c-2-34 22-52 46-50 26 2 40 20 38 42-16-14-48-18-84 8z" fill="#2B1E3F"/>
        <path d="M196 240l14 4M226 244l14-4" stroke="#3A2230" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="204" cy="250" r="3.6" fill="#3A2230"/><circle cx="232" cy="250" r="3.6" fill="#3A2230"/>
        <path d="M204 264q14 10 30-4" stroke="#3A2230" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M150 380c-14-40-16-90-6-130" stroke="url(#tdSkinA)" stroke-width="18" stroke-linecap="round"/>
        <g transform="rotate(-12 140 196)">
          <rect x="100" y="132" width="84" height="122" rx="12" fill="#FF4D6D"/>
          <rect x="108" y="140" width="68" height="106" rx="8" stroke="${card}" stroke-opacity=".5" stroke-width="2"/>
          <path d="M146 162l-14 22h10l-3 16 15-22h-10z" fill="#FFE7A0"/>
          <text x="142" y="228" text-anchor="middle" font-family="Inter" font-weight="600" font-size="15" letter-spacing="3" fill="${card}">DARE</text>
        </g>
        <circle cx="146" cy="252" r="13" fill="#EDB894"/>

        <!-- him: hiding behind his hands, one eye peeking -->
        <rect x="410" y="266" width="26" height="78" rx="10" fill="#8A5638"/>
        <path d="M330 470c-2-134 30-184 92-184s94 50 92 184z" fill="#FF9EC4"/>
        <path d="M410 288q13 15 26 0z" fill="#8A5638"/>
        
        <circle cx="386" cy="238" r="8" fill="#8A5638"/><circle cx="460" cy="238" r="8" fill="#8A5638"/>
        <circle cx="423" cy="236" r="39" fill="url(#tdSkinB)"/>
        <path d="M385 228c-4-34 18-52 40-52 26 0 40 18 36 46-10-12-22-16-38-16s-28 8-38 22z" fill="#18121F"/>
        <circle cx="410" cy="232" r="7" fill="#FFFFFF"/><circle cx="436" cy="232" r="7" fill="#FFFFFF"/>
        <circle cx="411" cy="233" r="3.8" fill="#2A1810"/><circle cx="437" cy="233" r="3.8" fill="#2A1810"/>
        <path d="M400 218q8-6 16-2M428 216q8-4 16 2" stroke="#18121F" stroke-width="3" stroke-linecap="round"/>
        <path d="M372 380c-4-40 4-80 26-108M474 380c4-40-4-80-26-108" stroke="url(#tdSkinB)" stroke-width="18" stroke-linecap="round"/>
        <rect x="392" y="246" width="34" height="40" rx="16" fill="#93603F" transform="rotate(-12 409 266)"/>
        <rect x="420" y="246" width="34" height="40" rx="16" fill="#8A5638" transform="rotate(12 437 266)"/>
      </g>
    </svg>`,
  // Getting to know you: seen from above, lying head to head on a gingham picnic blanket, talking.
  picnic: ({ card }) => `
    <svg width="600" height="430" viewBox="0 0 640 460" fill="none">
      <defs>
        <pattern id="gingham" width="44" height="44" patternUnits="userSpaceOnUse">
          <rect width="44" height="44" fill="#FFF8EE"/>
          <rect width="22" height="44" fill="#FF4D6D" opacity=".28"/>
          <rect width="44" height="22" fill="#FF4D6D" opacity=".28"/>
        </pattern>
        <linearGradient id="pnSkinA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="pnSkinB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
      </defs>

      <g transform="rotate(-8 320 230)">
        <!-- blanket -->
        <rect x="70" y="100" width="500" height="260" rx="16" fill="url(#gingham)"/>
        <rect x="70" y="100" width="500" height="260" rx="16" stroke="#FF4D6D" stroke-opacity=".35" stroke-width="4"/>

        <!-- her, lying toward the left (top of her head points right, toward him) -->
        <rect x="-10" y="200" width="150" height="26" rx="13" fill="#2D3A6B"/>
        <rect x="-4" y="232" width="150" height="26" rx="13" fill="#2D3A6B"/>
        <rect x="120" y="190" width="156" height="78" rx="36" fill="#FFE7A0"/>
        <path d="M232 196c16-22 34-34 52-38" stroke="url(#pnSkinA)" stroke-width="16" stroke-linecap="round"/>
        <path d="M200 268c20 18 42 24 62 20" stroke="url(#pnSkinA)" stroke-width="16" stroke-linecap="round"/>
        <path d="M300 182c34-6 58 18 56 48s-24 52-56 46c14-12 20-28 20-46s-6-36-20-48z" fill="#2B1E3F"/>
        <circle cx="292" cy="229" r="30" fill="url(#pnSkinA)"/>
        <path d="M296 200c14 2 24 14 26 29-2 15-12 27-26 29 8-8 12-18 12-29s-4-21-12-29z" fill="#2B1E3F"/>
        <circle cx="300" cy="219" r="3.4" fill="#3A2230"/><circle cx="300" cy="239" r="3.4" fill="#3A2230"/>
        <path d="M278 221q-7 8 0 16" stroke="#3A2230" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse cx="290" cy="208" rx="5" ry="4" fill="#FF4D6D" opacity=".3"/>

        <!-- him, lying toward the right (top of his head points left, toward her) -->
        <rect x="526" y="208" width="150" height="26" rx="13" fill="#1F2A55"/>
        <rect x="520" y="240" width="150" height="26" rx="13" fill="#1F2A55"/>
        <rect x="388" y="196" width="160" height="80" rx="36" fill="${card}"/>
        <path d="M430 196c-8-22-2-40 10-52" stroke="url(#pnSkinB)" stroke-width="16" stroke-linecap="round"/>
        <path d="M470 276c-6 20-20 32-38 38" stroke="url(#pnSkinB)" stroke-width="16" stroke-linecap="round"/>
        <circle cx="384" cy="236" r="31" fill="url(#pnSkinB)"/>
        <path d="M376 206c-14 4-22 16-22 30s8 26 22 30c-6-8-8-18-8-30s2-22 8-30z" fill="#18121F"/>
        <circle cx="376" cy="226" r="3.4" fill="#2A1810"/><circle cx="376" cy="246" r="3.4" fill="#2A1810"/>
        <path d="M398 228q7 8 0 16" stroke="#2A1810" stroke-width="2.6" stroke-linecap="round"/>

        <!-- an open book and two mugs on the blanket -->
        <path d="M150 120l50 8v46l-50-8zM200 128l50-8v46l-50 8z" fill="${card}" stroke="#E5DCCB" stroke-width="2"/>
        <circle cx="500" cy="138" r="18" fill="#FF4D6D"/><circle cx="500" cy="138" r="11" fill="#6B3A22"/>
        <circle cx="540" cy="150" r="18" fill="#0B8A62"/><circle cx="540" cy="150" r="11" fill="#6B3A22"/>
      </g>
    </svg>`,
  // Free dates: riding a tandem bike, side view — her ponytail flying, both grinning.
  tandem: () => `
    <svg width="600" height="390" viewBox="40 60 580 377" fill="none">
      <defs>
        <linearGradient id="tbSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="tbSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
      </defs>
      <ellipse cx="320" cy="400" rx="250" ry="8" fill="#3A1C10" opacity=".15"/>

      <!-- wheels -->
      <g stroke="#3A1C10">
        <circle cx="170" cy="320" r="72" stroke-width="12"/>
        <circle cx="490" cy="320" r="72" stroke-width="12"/>
        <path d="M170 254v132M104 320h132M123 273l94 94M123 367l94-94M490 254v132M424 320h132M443 273l94 94M443 367l94-94" stroke-width="2.5" opacity=".35"/>
      </g>
      <circle cx="170" cy="320" r="8" fill="#3A1C10"/><circle cx="490" cy="320" r="8" fill="#3A1C10"/>

      <!-- frame -->
      <path d="M170 320L246 214H404L490 320M246 214L300 322L404 214L420 322M300 322H420M170 320H300" stroke="#FF4D6D" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M404 214l14-46h34" stroke="#3A1C10" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M216 202h46M346 202h46" stroke="#3A1C10" stroke-width="12" stroke-linecap="round"/>
      <circle cx="300" cy="322" r="14" fill="#3A1C10"/><circle cx="420" cy="322" r="14" fill="#3A1C10"/>

      <!-- her (behind) -->
      <path d="M238 196l46 56-4 70" stroke="#2D3A6B" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M240 194l30-66" stroke="#FFE7A0" stroke-width="48" stroke-linecap="round"/>
      <path d="M274 140l60 54" stroke="url(#tbSkinA)" stroke-width="15" stroke-linecap="round"/>
      <path d="M262 92c-26-4-46 6-60 22 20-2 38 2 52 12z" fill="#2B1E3F"/>
      <rect x="270" y="112" width="18" height="22" rx="7" fill="#E8B08C"/>
      <circle cx="286" cy="96" r="27" fill="url(#tbSkinA)"/>
      <path d="M260 92c0-22 18-34 34-30 14 4 22 14 20 24-14-8-34-6-54 6z" fill="#2B1E3F"/>
      <circle cx="300" cy="96" r="3.4" fill="#3A2230"/>
      <path d="M296 108q8 6 14-2" stroke="#3A2230" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="292" cy="106" rx="5" ry="3.5" fill="#FF4D6D" opacity=".3"/>

      <!-- him (front) -->
      <path d="M368 196l44 56-2 70" stroke="#1F2A55" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M370 194l32-68" stroke="#8EC5FF" stroke-width="50" stroke-linecap="round"/>
      <path d="M406 140l46 28" stroke="url(#tbSkinB)" stroke-width="15" stroke-linecap="round"/>
      <rect x="400" y="108" width="20" height="24" rx="7" fill="#8A5638"/>
      <circle cx="418" cy="92" r="28" fill="url(#tbSkinB)"/>
      <path d="M390 90c-4-24 12-38 30-38 20 0 32 14 28 30-10-8-24-10-38-6-8 2-14 8-20 14z" fill="#18121F"/>
      <circle cx="404" cy="98" r="6" fill="#8A5638"/>
      <circle cx="432" cy="92" r="3.4" fill="#2A1810"/>
      <path d="M428 104q8 7 16-1" stroke="#2A1810" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="452" cy="168" r="10" fill="#93603F"/>
    </svg>`,
  // After an argument: making up with a pinky promise — soft smiles, glancing at each other.
  pinky: ({ card }) => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>
        <linearGradient id="pkSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="pkSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <linearGradient id="pkFadeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#fff"/>
        </linearGradient>
        <mask id="pkFade"><rect x="0" y="0" width="640" height="480" fill="url(#pkFadeG)"/></mask>
      </defs>
      <g mask="url(#pkFade)">
        <!-- her -->
        <path d="M180 300c-10-62 6-118 40-118s50 56 40 118z" fill="#2B1E3F"/>
        <rect x="208" y="262" width="24" height="40" rx="10" fill="#E8B08C"/>
        <path d="M140 480c-2-130 30-200 80-200s82 70 80 200z" fill="${card}"/>
        <path d="M207 282q13 15 26 0z" fill="#E8B08C"/>
        <circle cx="220" cy="236" r="38" fill="url(#pkSkinA)"/>
        <path d="M182 232c-2-32 22-50 44-48 24 2 38 18 36 40-14-14-46-18-80 8z" fill="#2B1E3F"/>
        <circle cx="229" cy="241" r="3.6" fill="#3A2230"/><circle cx="251" cy="241" r="3.6" fill="#3A2230"/>
        <path d="M228 257q9 6 18 0" stroke="#3A2230" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse cx="210" cy="254" rx="7" ry="4.5" fill="#FF4D6D" opacity=".25"/>

        <!-- him -->
        <rect x="407" y="258" width="26" height="42" rx="10" fill="#8A5638"/>
        <path d="M338 480c-2-134 32-204 82-204s84 70 82 204z" fill="#1D5BD8"/>
        <path d="M407 278q13 15 26 0z" fill="#8A5638"/>
        <circle cx="383" cy="236" r="8" fill="#8A5638"/><circle cx="457" cy="236" r="8" fill="#8A5638"/>
        <circle cx="420" cy="232" r="39" fill="url(#pkSkinB)"/>
        <path d="M383 222c-4-34 18-52 40-52 26 0 40 18 36 46-10-12-22-16-38-16s-28 8-38 22z" fill="#18121F"/>
        <circle cx="402" cy="237" r="3.6" fill="#2A1810"/><circle cx="424" cy="237" r="3.6" fill="#2A1810"/>
        <path d="M402 253q9 6 18 0" stroke="#2A1810" stroke-width="2.6" stroke-linecap="round"/>

        <!-- arms reaching in, pinkies hooked -->
        <path d="M262 420c14-34 30-60 50-78" stroke="url(#pkSkinA)" stroke-width="18" stroke-linecap="round"/>
        <path d="M378 420c-14-34-30-60-50-78" stroke="url(#pkSkinB)" stroke-width="18" stroke-linecap="round"/>
        <circle cx="312" cy="342" r="13" fill="#EDB894"/>
        <circle cx="328" cy="342" r="13" fill="#93603F"/>
        <path d="M314 332q6-14 12 0" stroke="#EDB894" stroke-width="7" stroke-linecap="round"/>
        <path d="M314 334q6 12 12 0" stroke="#93603F" stroke-width="7" stroke-linecap="round"/>
      </g>
    </svg>`,
  // Long-distance truths: the first hug at arrivals — cheek to cheek, eyes shut, suitcase beside them.
  arrivals: ({ card }) => `
    <svg width="560" height="420" viewBox="60 20 520 390" fill="none">
      <defs>
        <linearGradient id="arSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="arSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <linearGradient id="arFadeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#fff"/>
        </linearGradient>
        <mask id="arFade"><rect x="0" y="0" width="640" height="480" fill="url(#arFadeG)"/></mask>
      </defs>
      <rect x="196" y="36" width="248" height="58" rx="10" fill="#1F1B3A"/>
      <text x="320" y="73" text-anchor="middle" font-family="Inter" font-weight="600" font-size="22" letter-spacing="5" fill="#FFFFFF">ARRIVALS →</text>
      <path d="M260 36V20M380 36V20" stroke="#1F1B3A" stroke-width="5"/>
      <g mask="url(#arFade)">
        <!-- suitcase -->
        <rect x="474" y="292" width="78" height="130" rx="14" fill="#FF4D6D"/>
        <path d="M494 292v-22h38v22" stroke="#1F1B3A" stroke-width="7" stroke-linejoin="round"/>
        <path d="M494 318v80M532 318v80" stroke="#D93556" stroke-width="5" stroke-linecap="round"/>
        <rect x="460" y="330" width="22" height="34" rx="4" fill="#FFE7A0" transform="rotate(-12 471 347)"/>

        <!-- him (behind) -->
        <rect x="346" y="246" width="26" height="42" rx="10" fill="#8A5638"/>
        <path d="M262 480c-2-140 42-210 98-210s100 70 98 210z" fill="#8EC5FF"/>
        <path d="M347 268q13 15 26 0z" fill="#8A5638"/>
        <g transform="rotate(-10 352 226)">
          <circle cx="388" cy="230" r="8" fill="#8A5638"/>
          <circle cx="352" cy="226" r="37" fill="url(#arSkinB)"/>
          <path d="M316 216c-4-34 18-52 40-52 26 0 40 18 36 46-10-12-22-16-38-16s-28 8-38 22z" fill="#18121F"/>
          <path d="M346 232q6-6 12 0M366 232q6-6 12 0" stroke="#2A1810" stroke-width="3" stroke-linecap="round"/>
          <path d="M352 248q8 6 16 0" stroke="#2A1810" stroke-width="2.6" stroke-linecap="round"/>
        </g>

        <!-- her (in front), arms around him -->
        <path d="M250 300c-12-64 4-120 40-120s52 56 40 120z" fill="#2B1E3F"/>
        <rect x="274" y="256" width="24" height="40" rx="10" fill="#E8B08C"/>
        <path d="M190 480c-2-134 40-200 96-200s98 66 96 200z" fill="${card}"/>
        <path d="M273 276q13 15 26 0z" fill="#E8B08C"/>
        <path d="M330 310c30-14 56-30 70-50" stroke="url(#arSkinA)" stroke-width="17" stroke-linecap="round"/>
        <circle cx="402" cy="258" r="11" fill="#EDB894"/>
        <g transform="rotate(10 290 236)">
          <circle cx="290" cy="236" r="36" fill="url(#arSkinA)"/>
          <path d="M254 232c-2-32 20-48 40-47 22 1 34 16 33 36-14-14-40-16-73 11z" fill="#2B1E3F"/>
          <path d="M276 240q6-6 12 0M298 240q6-6 12 0" stroke="#3A2230" stroke-width="3" stroke-linecap="round"/>
          <path d="M282 255q9 7 18 0" stroke="#3A2230" stroke-width="2.6" stroke-linecap="round"/>
          <ellipse cx="270" cy="252" rx="6" ry="4" fill="#FF4D6D" opacity=".3"/>
        </g>
      </g>
    </svg>`,

  // Attachment styles: shoulder to shoulder, arms crossed, faces turned away in a little pout.
  backtoback: ({ card }) => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>
        <linearGradient id="bbSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="bbSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <linearGradient id="bbFadeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#fff"/>
        </linearGradient>
        <mask id="bbFade"><rect x="0" y="0" width="640" height="480" fill="url(#bbFadeG)"/></mask>
      </defs>
      <g mask="url(#bbFade)">
        <!-- her: turned to the left, pouting -->
        <path d="M188 302c-12-64 6-120 42-120s52 56 40 120z" fill="#2B1E3F"/>
        <rect x="218" y="262" width="24" height="40" rx="10" fill="#E8B08C"/>
        <path d="M150 480c-2-130 30-200 80-200s82 70 80 200z" fill="#C3B1FF"/>
        <path d="M217 282q13 15 26 0z" fill="#E8B08C"/>
        <g transform="rotate(-10 230 236)">
          <circle cx="230" cy="236" r="38" fill="url(#bbSkinA)"/>
          <path d="M192 232c-2-32 22-50 44-48 24 2 38 18 36 40-14-14-46-18-80 8z" fill="#2B1E3F"/>
          <path d="M206 232l14 3M228 235l14-3" stroke="#3A2230" stroke-width="3" stroke-linecap="round"/>
          <circle cx="212" cy="244" r="3.6" fill="#3A2230"/><circle cx="234" cy="244" r="3.6" fill="#3A2230"/>
          <path d="M214 262q8-5 16 0" stroke="#3A2230" stroke-width="2.6" stroke-linecap="round"/>
          <ellipse cx="248" cy="256" rx="7" ry="4.5" fill="#FF4D6D" opacity=".25"/>
        </g>
        <path d="M176 372c34-20 72-20 108 2" stroke="url(#bbSkinA)" stroke-width="20" stroke-linecap="round"/>
        <path d="M180 392c36 14 72 12 104-8" stroke="#F2BE9C" stroke-width="20" stroke-linecap="round"/>

        <!-- him: turned to the right, same pout -->
        <rect x="399" y="258" width="26" height="42" rx="10" fill="#8A5638"/>
        <path d="M330 480c-2-134 32-204 82-204s84 70 82 204z" fill="#1F1B3A"/>
        <path d="M399 278q13 15 26 0z" fill="#8A5638"/>
        <g transform="rotate(10 412 232)">
          <circle cx="376" cy="236" r="8" fill="#8A5638"/><circle cx="448" cy="236" r="8" fill="#8A5638"/>
          <circle cx="412" cy="232" r="39" fill="url(#bbSkinB)"/>
          <path d="M375 222c-4-34 18-52 40-52 26 0 40 18 36 46-10-12-22-16-38-16s-28 8-38 22z" fill="#18121F"/>
          <path d="M406 230l14 3M428 233l14-3" stroke="#18121F" stroke-width="3" stroke-linecap="round"/>
          <circle cx="420" cy="240" r="3.6" fill="#2A1810"/><circle cx="442" cy="240" r="3.6" fill="#2A1810"/>
          <path d="M422 258q8-5 16 0" stroke="#2A1810" stroke-width="2.6" stroke-linecap="round"/>
        </g>
        <path d="M358 368c36-20 76-20 112 2" stroke="url(#bbSkinB)" stroke-width="20" stroke-linecap="round"/>
        <path d="M362 388c38 14 76 12 108-8" stroke="#93603F" stroke-width="20" stroke-linecap="round"/>
      </g>
    </svg>`,

  // Grade your relationship: proudly holding up their report card — a big red A+.
  reportcard: ({ card }) => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>
        <linearGradient id="rcSkinA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F6CDAE"/><stop offset="1" stop-color="#F6CDAE"/>
        </linearGradient>
        <linearGradient id="rcSkinB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#A86F4C"/><stop offset="1" stop-color="#A86F4C"/>
        </linearGradient>
        <linearGradient id="rcFadeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#fff"/>
        </linearGradient>
        <mask id="rcFade"><rect x="0" y="0" width="640" height="480" fill="url(#rcFadeG)"/></mask>
      </defs>
      <g mask="url(#rcFade)">
        <!-- her -->
        <path d="M170 300c-10-62 6-118 40-118s50 56 40 118z" fill="#2B1E3F"/>
        <rect x="198" y="262" width="24" height="40" rx="10" fill="#E8B08C"/>
        <path d="M130 480c-2-130 30-200 80-200s82 70 80 200z" fill="#FF9EC4"/>
        <path d="M197 282q13 15 26 0z" fill="#E8B08C"/>
        <circle cx="210" cy="236" r="38" fill="url(#rcSkinA)"/>
        <path d="M172 232c-2-32 22-50 44-48 24 2 38 18 36 40-14-14-46-18-80 8z" fill="#2B1E3F"/>
        <path d="M194 242q6-6 12 0M218 242q6-6 12 0" stroke="#3A2230" stroke-width="3" stroke-linecap="round"/>
        <path d="M198 256q14 14 28 0z" fill="#3A2230"/>
        <ellipse cx="190" cy="256" rx="7" ry="4.5" fill="#FF4D6D" opacity=".28"/>

        <!-- him -->
        <rect x="417" y="258" width="26" height="42" rx="10" fill="#8A5638"/>
        <path d="M348 480c-2-134 32-204 82-204s84 70 82 204z" fill="#8EC5FF"/>
        <path d="M417 278q13 15 26 0z" fill="#8A5638"/>
        <circle cx="393" cy="236" r="8" fill="#8A5638"/><circle cx="467" cy="236" r="8" fill="#8A5638"/>
        <circle cx="430" cy="232" r="39" fill="url(#rcSkinB)"/>
        <path d="M393 222c-4-34 18-52 40-52 26 0 40 18 36 46-10-12-22-16-38-16s-28 8-38 22z" fill="#18121F"/>
        <path d="M412 238q6-6 12 0M436 238q6-6 12 0" stroke="#2A1810" stroke-width="3" stroke-linecap="round"/>
        <path d="M416 252q14 14 28 0z" fill="#2A1810"/>

        <!-- the report card they're holding up together -->
        <g transform="rotate(-4 320 350)">
          <rect x="236" y="290" width="168" height="200" rx="8" fill="${card}"/>
          <path d="M258 316h80M258 338h120M258 360h100" stroke="#1A1A1A" stroke-opacity=".2" stroke-width="5" stroke-linecap="round"/>
          <ellipse cx="320" cy="420" rx="52" ry="40" stroke="#D93556" stroke-width="6"/>
          <text x="320" y="440" text-anchor="middle" font-family="Serif" font-size="56" fill="#D93556">A+</text>
        </g>
        <circle cx="242" cy="300" r="12" fill="#EDB894"/><circle cx="398" cy="296" r="12" fill="#93603F"/>
        <path d="M230 420c-6-50 2-90 12-118M410 420c6-50-2-92-12-122" stroke-width="17" stroke-linecap="round" stroke="#00000000"/>
      </g>
    </svg>`,
  // Weeknight dates: a jigsaw puzzle on the coffee table, two mugs of tea.
  puzzle: ({ card }) => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>${figureDefs('pz')}</defs>
      <g mask="url(#pzFade)">
        ${bust({ px: 'pz', cx: 220, skin: 'A', shirt: '#8EC5FF', tilt: 6, eyes: 'happy', mouth: 'smile' })}
        ${bust({ px: 'pz', cx: 420, skin: 'B', shirt: '#FFE7A0', hair: 'short', tilt: -6, eyes: 'open', mouth: 'grin' })}
        <rect x="110" y="372" width="420" height="22" rx="11" fill="#3A1C10"/>
        <rect x="200" y="346" width="230" height="30" rx="6" fill="${card}"/>
        <path d="M214 352h40v8a6 6 0 1 0 0 12v4h-40zM262 352h44v24h-44zM314 352h40v6a6 6 0 1 1 0 12v6h-40zM362 352h54v24h-54z" fill="#FFB38A"/>
        <path d="M262 352h44v24h-44z" fill="#FF4D6D" opacity=".7"/><path d="M362 352h54v24h-54z" fill="#88E3B5"/>
        <path d="M150 336h32l-4 38h-24z" fill="${card}"/><path d="M182 344q12 0 12 9t-12 9" stroke="${card}" stroke-width="5"/>
        <path d="M460 336h32l-4 38h-24z" fill="#FF4D6D"/><path d="M492 344q12 0 12 9t-12 9" stroke="#FF4D6D" stroke-width="5"/>
      </g>
    </svg>`,

  // Never admit it: she's swimming in his hoodie, sleeves past her hands; he holds an empty hanger.
  hoodie: ({ card }) => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>${figureDefs('hd')}</defs>
      <g mask="url(#hdFade)">
        <path d="M120 480c-6-150 38-226 100-226s106 76 100 226z" fill="#1F1B3A"/>
        <path d="M168 258c8-40 30-58 52-58s44 18 52 58c-16-10-34-14-52-14s-36 4-52 14z" fill="#2D2952"/>
        ${bust({ px: 'hd', cx: 220, skin: 'A', shirt: '#1F1B3A', tilt: -4, eyes: 'left', mouth: 'smirk', brows: 'sly' })}
        <path d="M200 300l-6 40M240 300l6 40" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
        <path d="M164 318c-18 30-22 64-14 96M276 318c18 30 22 64 14 96" stroke="#2D2952" stroke-width="40" stroke-linecap="round"/>
        <circle cx="152" cy="430" r="8" fill="#EDB894"/><circle cx="288" cy="430" r="8" fill="#EDB894"/>
        ${bust({ px: 'hd', cx: 420, skin: 'B', shirt: '#FFFFFF', hair: 'short', tilt: 8, eyes: 'wide', mouth: 'o', brows: 'raised' })}
        <path d="M520 246v12" stroke="#7A7A88" stroke-width="5" stroke-linecap="round"/>
        <path d="M520 258l-46 30h92z" stroke="#7A7A88" stroke-width="6" stroke-linejoin="round" fill="none"/>
        ${arm({ px: 'hd', skin: 'B', sleeve: '#FFFFFF', from: [454, 324], elbow: [506, 330], hand: [520, 266] })}
        <path d="M513 238a8 8 0 1 1 13 4" stroke="#7A7A88" stroke-width="5" stroke-linecap="round" fill="none"/>
      </g>
    </svg>`,

  // Finish the sentence: writing in one shared notebook, she has the pencil, he leans in to read.
  notebook: ({ card }) => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>${figureDefs('nt')}</defs>
      <g mask="url(#ntFade)">
        ${bust({ px: 'nt', cx: 220, skin: 'A', shirt: '#FF9EC4', tilt: 8, eyes: 'right', mouth: 'smile' })}
        ${bust({ px: 'nt', cx: 420, skin: 'B', shirt: '#FFE7A0', hair: 'short', tilt: -12, eyes: 'left', mouth: 'grin' })}
        <rect x="100" y="388" width="440" height="100" fill="#4A3AB0"/>
        <rect x="90" y="380" width="460" height="20" rx="10" fill="#2C2178"/>
        <g transform="rotate(-4 320 360)">
          <path d="M210 340l110-10 110 10v42l-110-8-110 8z" fill="${card}"/>
          <path d="M320 330v44" stroke="#D5CFF0" stroke-width="3"/>
          <path d="M232 350h70M232 362h60M340 350h70M340 362h50" stroke="#C3B1FF" stroke-width="3" stroke-linecap="round"/>
        </g>
        <!-- writing hand: forearm resting on the table, simple round hand over the pencil (house style) -->
        <path d="M300 330L314 370" stroke="#FFD93D" stroke-width="7" stroke-linecap="round"/>
        <path d="M313 367l3 7" stroke="#1A1A1A" stroke-width="4" stroke-linecap="round"/>
        <path d="M178 374L216 369" stroke="#FF9EC4" stroke-width="26" stroke-linecap="round"/>
        <path d="M214 369L290 361" stroke="url(#ntA)" stroke-width="16" stroke-linecap="round"/>
        <circle cx="300" cy="358" r="11" fill="#EDB894"/>
      </g>
    </svg>`,

  // Green flags: he holds the umbrella over her, tilted her way.
  umbrella: ({ card }) => `
    <svg width="540" height="436" viewBox="70 70 500 403" fill="none">
      <defs>${figureDefs('um')}</defs>
      <path d="M150 196c20-70 90-104 170-104s150 34 170 104c-20-10-40-10-56 0-16-10-40-10-56 0-16-10-42-10-58 0-16-10-42-10-58 0-16-10-40-10-56 0-18-10-36-10-56 0z" fill="#22B36B" transform="rotate(-6 320 150)"/>
      <path d="M320 92V80" stroke="#3A3A3A" stroke-width="6" stroke-linecap="round"/>
      <g mask="url(#umFade)">
        ${bust({ px: 'um', cx: 220, skin: 'A', shirt: '#FFFFFF', tilt: 6, eyes: 'happy', mouth: 'smile' })}
        ${bust({ px: 'um', cx: 420, skin: 'B', shirt: '#1F2A55', hair: 'short', tilt: -4, eyes: 'left', mouth: 'smile' })}
        <path d="M330 160v190" stroke="#3A3A3A" stroke-width="7" stroke-linecap="round"/>
        ${arm({ px: 'um', skin: 'B', sleeve: '#1F2A55', from: [386, 324], elbow: [362, 352], hand: [334, 334] })}
      </g>
    </svg>`,
  // Love jar: a glass jar of folded notes on the table; she pulls one out, he leans in to read it.
  lovejar: ({ card }) => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>${figureDefs('lj')}
        <clipPath id="ljGlass"><path d="M262 300h116v110a20 20 0 0 1-20 20h-76a20 20 0 0 1-20-20z"/></clipPath>
      </defs>
      <g mask="url(#ljFade)">
        ${bust({ px: 'lj', cx: 200, skin: 'A', shirt: '#FFE7A0', tilt: 4, eyes: 'right', mouth: 'grin' })}
        ${bust({ px: 'lj', cx: 440, skin: 'B', shirt: '#1F1B3A', hair: 'short', tilt: -10, eyes: 'left', mouth: 'smile' })}
        <rect x="90" y="428" width="460" height="60" fill="#A63B1A"/>
        <rect x="80" y="420" width="480" height="20" rx="10" fill="#7A2A10"/>
        <!-- the jar -->
        <rect x="270" y="282" width="100" height="22" rx="6" fill="#B5763F"/>
        <path d="M262 300h116v110a20 20 0 0 1-20 20h-76a20 20 0 0 1-20-20z" fill="#FFFFFF" fill-opacity=".35" stroke="${card}" stroke-width="5"/>
        <g clip-path="url(#ljGlass)">
          <rect x="272" y="390" width="34" height="18" rx="3" fill="#FF9EC4" transform="rotate(-14 289 399)"/>
          <rect x="304" y="396" width="34" height="18" rx="3" fill="#FFD93D" transform="rotate(10 321 405)"/>
          <rect x="336" y="388" width="34" height="18" rx="3" fill="#8EC5FF" transform="rotate(-8 353 397)"/>
          <rect x="284" y="366" width="34" height="18" rx="3" fill="#88E3B5" transform="rotate(16 301 375)"/>
          <rect x="318" y="362" width="34" height="18" rx="3" fill="${card}" transform="rotate(-18 335 371)"/>
          <rect x="300" y="340" width="34" height="18" rx="3" fill="#FFB38A" transform="rotate(6 317 349)"/>
        </g>
        <path d="M282 312c-2 30-2 70 4 100" stroke="${card}" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"/>
        <!-- her hand lifting a note out -->
        ${arm({ px: 'lj', skin: 'A', sleeve: '#FFE7A0', from: [234, 324], elbow: [284, 336], hand: [304, 272] })}
        <g transform="rotate(-10 330 246)">
          <rect x="300" y="226" width="64" height="40" rx="4" fill="${card}"/>
          <path d="M332 226v40" stroke="#E5DCCB" stroke-width="2"/>
          <path d="M332 252c-8-6-12-10-12-14a5 5 0 0 1 12-2 5 5 0 0 1 12 2c0 4-4 8-12 14z" fill="#FF4D6D"/>
        </g>
      </g>
    </svg>`,
  // Never have I ever: both holding a hand up, fingers raised, mid-laugh.
  nhie: () => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>${figureDefs('nh')}</defs>
      <g mask="url(#nhFade)">
        ${bust({ px: 'nh', cx: 220, skin: 'A', shirt: '#FF9EC4', tilt: 6, eyes: 'happy', mouth: 'grin' })}
        ${arm({ px: 'nh', skin: 'A', sleeve: '#FF9EC4', from: [186, 324], elbow: [138, 280], hand: [150, 222] })}
        ${fingers(150, 222, 'A', 3)}
        ${bust({ px: 'nh', cx: 420, skin: 'B', shirt: '#FFD93D', hair: 'short', tilt: -6, eyes: 'open', mouth: 'smirk', brows: 'raised' })}
        ${arm({ px: 'nh', skin: 'B', sleeve: '#FFD93D', from: [454, 324], elbow: [502, 280], hand: [490, 222] })}
        ${fingers(490, 222, 'B', 2)}
      </g>
    </svg>`,

  // Bucket list: holding an unfolded map between them, a dotted route and three pins.
  map: ({ card }) => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>${figureDefs('mp')}</defs>
      <g mask="url(#mpFade)">
        ${bust({ px: 'mp', cx: 200, skin: 'A', shirt: '#0B8A62', tilt: 6, eyes: 'right', mouth: 'grin' })}
        ${bust({ px: 'mp', cx: 440, skin: 'B', shirt: '#D93556', hair: 'short', tilt: -6, eyes: 'left', mouth: 'smile' })}
        <g transform="rotate(-3 320 372)">
          <path d="M210 318l70 12 70-12 70 12v100l-70-12-70 12-70-12z" fill="#FBF3E2"/>
          <path d="M280 330v100M350 318v100" stroke="#E2D3B2" stroke-width="3"/>
          <path d="M226 400c30-30 60 10 90-20s60-40 90-10" stroke="#D93556" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round"/>
          <path d="M236 392c-8-12 0-24 10-24s18 12 10 24l-10 12z" fill="#1D5BD8"/>
          <path d="M316 372c-8-12 0-24 10-24s18 12 10 24l-10 12z" fill="#0B8A62"/>
          <path d="M396 360c-8-12 0-24 10-24s18 12 10 24l-10 12z" fill="#D93556"/>
        </g>
        ${arm({ px: 'mp', skin: 'A', sleeve: '#0B8A62', from: [234, 324], elbow: [234, 352], hand: [214, 342] })}
        ${arm({ px: 'mp', skin: 'B', sleeve: '#D93556', from: [406, 324], elbow: [406, 352], hand: [426, 336] })}
      </g>
    </svg>`,

  // Moving in: carrying one big moving box together, a plant riding on top.
  movingbox: () => `
    <svg width="560" height="400" viewBox="70 100 500 373" fill="none">
      <defs>${figureDefs('mv')}</defs>
      <g mask="url(#mvFade)">
        ${bust({ px: 'mv', cx: 200, skin: 'A', shirt: '#8EC5FF', tilt: 6, eyes: 'right', mouth: 'grin' })}
        ${bust({ px: 'mv', cx: 440, skin: 'B', shirt: '#FFE7A0', hair: 'short', tilt: -6, eyes: 'left', mouth: 'grin' })}
        <rect x="236" y="320" width="168" height="130" rx="6" fill="#C89B6D"/>
        <rect x="236" y="320" width="168" height="26" fill="#B5875A"/>
        <rect x="310" y="320" width="20" height="130" fill="#E9D3A8" opacity=".8"/>
        <text x="282" y="400" font-family="Script" font-size="26" fill="#2A1A10">us</text>
        <path d="M300 320c-6-30 6-44 20-44s26 14 20 44z" fill="#FF4D6D"/>
        <path d="M320 276c-10-24-30-30-40-26 4 18 22 28 40 26zM320 276c10-24 30-30 40-26-4 18-22 28-40 26z" fill="#22B36B"/>
        ${arm({ px: 'mv', skin: 'A', sleeve: '#8EC5FF', from: [234, 324], elbow: [244, 360], hand: [240, 386] })}
        ${arm({ px: 'mv', skin: 'B', sleeve: '#FFE7A0', from: [406, 324], elbow: [396, 360], hand: [400, 386] })}
      </g>
    </svg>`,

  // Say this instead: talking it out — her bubble is scribbled out, his comes back with a heart.
  talkitout: ({ card }) => `
    <svg width="540" height="446" viewBox="70 60 500 413" fill="none">
      <defs>${figureDefs('tk')}</defs>
      <g transform="translate(0 -74)">
      <path d="M150 136h130a20 20 0 0 1 20 20v44a20 20 0 0 1-20 20h-90l-22 22v-22h-18a20 20 0 0 1-20-20v-44a20 20 0 0 1 20-20z" fill="${card}"/>
      <path d="M160 168c20-10 40 10 60 0s40 10 60 0M160 186c20-10 40 10 60 0s40 10 60 0" stroke="#3A1C10" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>
      <path d="M156 162l118 36" stroke="#D93556" stroke-width="6" stroke-linecap="round"/>
      <path d="M360 136h130a20 20 0 0 1 20 20v44a20 20 0 0 1-20 20h-18v22l-22-22h-90a20 20 0 0 1-20-20v-44a20 20 0 0 1 20-20z" fill="${card}"/>
      <path d="M425 196c-14-10-22-18-22-26a10 10 0 0 1 22-4 10 10 0 0 1 22 4c0 8-8 16-22 26z" fill="#FF4D6D"/>
      </g>
      <g mask="url(#tkFade)">
        ${bust({ px: 'tk', cx: 220, skin: 'A', shirt: '#B8441E', tilt: 6, eyes: 'right', mouth: 'flat' })}
        ${bust({ px: 'tk', cx: 420, skin: 'B', shirt: '#FFFFFF', hair: 'short', tilt: -6, eyes: 'left', mouth: 'smile' })}
      </g>
    </svg>`,
  // Couples bingo: a celebratory high five, both grinning.
  highfive: () => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>${figureDefs('h5')}</defs>
      <g mask="url(#h5Fade)">
        ${bust({ px: 'h5', cx: 200, skin: 'A', shirt: '#2E5BFF', tilt: 6, eyes: 'happy', mouth: 'grin' })}
        ${bust({ px: 'h5', cx: 440, skin: 'B', shirt: '#FF4D6D', hair: 'short', tilt: -6, eyes: 'happy', mouth: 'grin' })}
        ${arm({ px: 'h5', skin: 'A', sleeve: '#2E5BFF', from: [234, 324], elbow: [284, 268], hand: [310, 214] })}
        ${arm({ px: 'h5', skin: 'B', sleeve: '#FF4D6D', from: [406, 324], elbow: [356, 268], hand: [330, 214] })}
      </g>
    </svg>`,

  // When they're stressed: a back hug — his arm around her shoulders while she holds a warm mug.
  backhug: ({ card }) => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>${figureDefs('bh')}</defs>
      <g mask="url(#bhFade)">
        <g transform="translate(0 -26)">
          ${bust({ px: 'bh', cx: 390, skin: 'B', shirt: '#1D5BD8', hair: 'short', tilt: -10, eyes: 'closed', mouth: 'smile' })}
        </g>
        <!-- his arm wraps behind her back; her body covers it, only the hand shows at her far shoulder -->
        <path d="M352 290C310 290 256 292 214 300" stroke="#1D5BD8" stroke-width="24" stroke-linecap="round"/>
        <circle cx="212" cy="302" r="11" fill="#93603F"/>
        ${bust({ px: 'bh', cx: 270, skin: 'A', shirt: '#FFFFFF', tilt: 6, eyes: 'closed', mouth: 'smile' })}
        <path d="M258 352h44l-5 50h-34z" fill="#FF4D6D"/><path d="M302 362q14 0 14 12t-14 12" stroke="#FF4D6D" stroke-width="6"/>
        <circle cx="254" cy="380" r="11" fill="#EDB894"/><circle cx="302" cy="384" r="11" fill="#EDB894"/>
      </g>
    </svg>`,

  // Anniversary: a little cake with one candle between them, bunting overhead.
  anniversary: ({ card }) => `
    <svg width="560" height="410" viewBox="70 100 500 373" fill="none">
      <defs>${figureDefs('an')}</defs>
      <path d="M90 120Q320 190 550 120" stroke="#FFE7A0" stroke-width="3"/>
      <path d="M130 132l14 34 16-30zM200 150l12 34 18-30zM270 160l12 34 18-32zM340 160l14 34 16-32zM410 150l14 34 16-30zM480 132l14 34 14-32z" fill="#FF4D6D"/>
      <path d="M200 150l12 34 18-30zM340 160l14 34 16-32zM480 132l14 34 14-32z" fill="#FFE7A0"/>
      <g mask="url(#anFade)">
        ${bust({ px: 'an', cx: 200, skin: 'A', shirt: '#FF9EC4', tilt: 8, eyes: 'happy', mouth: 'smile' })}
        ${bust({ px: 'an', cx: 440, skin: 'B', shirt: '#2C2C2E', hair: 'short', tilt: -8, eyes: 'happy', mouth: 'smile' })}
        <rect x="100" y="404" width="440" height="80" fill="#3A3A3C"/>
        <rect x="90" y="396" width="460" height="18" rx="9" fill="#2C2C2E"/>
        <rect x="262" y="330" width="116" height="66" rx="10" fill="${card}"/>
        <path d="M262 346c10 10 20 10 29 0s20-10 29 0 20 10 29 0 20-10 29 0v-6a10 10 0 0 0-10-10h-96a10 10 0 0 0-10 10z" fill="#FF9EC4"/>
        <rect x="316" y="296" width="8" height="34" rx="3" fill="#FFE7A0"/>
        <path d="M320 272c8 8 8 18 0 22-8-4-8-14 0-22z" fill="#FFB020"/>
      </g>
    </svg>`,

  // Say vs. mean: reading the couples dictionary together — he wears glasses, she points at the entry.
  dictionary: ({ card }) => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>${figureDefs('dx')}</defs>
      <g mask="url(#dxFade)">
        ${bust({ px: 'dx', cx: 200, skin: 'A', shirt: '#5E4CCB', tilt: 6, eyes: 'right', mouth: 'grin' })}
        ${bust({ px: 'dx', cx: 440, skin: 'B', shirt: '#FFFFFF', hair: 'short', tilt: -6, eyes: 'left', mouth: 'smirk', brows: 'raised' })}
        <g transform="rotate(-6 440 232)">
          <circle cx="429" cy="238" r="12" stroke="#1F1B3A" stroke-width="3.5"/><circle cx="453" cy="238" r="12" stroke="#1F1B3A" stroke-width="3.5"/>
          <path d="M441 238h0M417 236l-10-4M465 236l10-4" stroke="#1F1B3A" stroke-width="3.5" stroke-linecap="round"/>
        </g>
        <path d="M200 350l120-14 120 14v76l-120-12-120 12z" fill="${card}"/>
        <path d="M320 336v78" stroke="#C3B1FF" stroke-width="4"/>
        <path d="M224 364h70M224 380h60M224 396h66M346 364h70M346 380h58M346 396h64" stroke="#C3B1FF" stroke-width="4" stroke-linecap="round"/>
        <path d="M196 432l124-12 124 12v14l-124-12-124 12z" fill="#5E4CCB"/>
        ${arm({ px: 'dx', skin: 'A', sleeve: '#5E4CCB', from: [234, 324], elbow: [250, 352], hand: [300, 358] })}
      </g>
    </svg>`,
  // Love-language dates: cooking together — she stirs the pot, he tastes from a spoon.
  cooking: ({ card }) => `
    <svg width="560" height="400" viewBox="70 110 500 363" fill="none">
      <defs>${figureDefs('ck')}</defs>
      <path d="M300 300q-10-14 0-28t0-28M330 296q-10-14 0-28t0-28" stroke="${card}" stroke-opacity=".8" stroke-width="5" stroke-linecap="round"/>
      <g mask="url(#ckFade)">
        ${bust({ px: 'ck', cx: 200, skin: 'A', shirt: '#FFFFFF', tilt: 6, eyes: 'right', mouth: 'smile' })}
        ${bust({ px: 'ck', cx: 440, skin: 'B', shirt: '#0B8A62', hair: 'short', tilt: -6, eyes: 'closed', mouth: 'smile' })}
        <rect x="100" y="404" width="440" height="80" fill="#2F8F6B"/>
        <rect x="90" y="396" width="460" height="18" rx="9" fill="#1E6E50"/>
        <path d="M262 340h112v42a14 14 0 0 1-14 14h-84a14 14 0 0 1-14-14z" fill="#FF4D6D"/>
        <rect x="254" y="334" width="128" height="12" rx="6" fill="#D93556"/>
        <path d="M296 352l-8-40" stroke="#B5763F" stroke-width="6" stroke-linecap="round"/>
        ${arm({ px: 'ck', skin: 'A', sleeve: '#FFFFFF', from: [234, 324], elbow: [250, 352], hand: [286, 316] })}
        <path d="M430 270l-34 34" stroke="#C9C9D6" stroke-width="5" stroke-linecap="round"/>
        <ellipse cx="428" cy="268" rx="9" ry="6" fill="#C9C9D6" transform="rotate(-45 428 268)"/>
        ${arm({ px: 'ck', skin: 'B', sleeve: '#0B8A62', from: [406, 324], elbow: [404, 352], hand: [394, 306] })}
      </g>
    </svg>`,

  // More romantic than flowers: in a gallery, admiring a framed heart painting; she points at it.
  gallery: () => `
    <svg width="540" height="460" viewBox="70 20 500 453" fill="none">
      <defs>${figureDefs('gl')}</defs>
      <rect x="240" y="34" width="160" height="128" rx="4" fill="#C9A25E"/>
      <rect x="252" y="46" width="136" height="104" fill="#FBF7EE"/>
      <path d="M320 132c-24-16-36-28-36-42a14 14 0 0 1 36-8 14 14 0 0 1 36 8c0 14-12 26-36 42z" fill="#FF4D6D"/>
      <rect x="296" y="174" width="48" height="16" rx="2" fill="#FFFFFF"/>
      <g mask="url(#glFade)">
        ${bust({ px: 'gl', cx: 220, skin: 'A', shirt: '#FFE7A0', tilt: 10, eyes: 'right', mouth: 'smile' })}
        ${bust({ px: 'gl', cx: 420, skin: 'B', shirt: '#3D3870', hair: 'short', tilt: -10, eyes: 'left', mouth: 'smile' })}
        ${arm({ px: 'gl', skin: 'A', sleeve: '#FFE7A0', from: [254, 324], elbow: [262, 290], hand: [276, 232] })}
      </g>
    </svg>`,

  // Mystery date: each holding a sealed envelope, about to open it.
  envelopes: () => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>${figureDefs('en')}</defs>
      <g mask="url(#enFade)">
        ${bust({ px: 'en', cx: 200, skin: 'A', shirt: '#C2185B', tilt: 6, eyes: 'happy', mouth: 'grin' })}
        ${bust({ px: 'en', cx: 440, skin: 'B', shirt: '#FFFFFF', hair: 'short', tilt: -6, eyes: 'wide', mouth: 'o', brows: 'raised' })}
        <g transform="rotate(-8 230 350)"><rect x="186" y="320" width="96" height="62" rx="6" fill="#FBF1E4"/><path d="M186 320l48 34 48-34" fill="#F2E2CE"/><circle cx="234" cy="354" r="11" fill="#2E5BFF"/></g>
        ${arm({ px: 'en', skin: 'A', sleeve: '#C2185B', from: [234, 324], elbow: [244, 360], hand: [266, 356] })}
        <g transform="rotate(8 410 350)"><rect x="362" y="320" width="96" height="62" rx="6" fill="#FBF1E4"/><path d="M362 320l48 34 48-34" fill="#F2E2CE"/><circle cx="410" cy="354" r="11" fill="#0B8A62"/></g>
        ${arm({ px: 'en', skin: 'B', sleeve: '#FFFFFF', from: [406, 324], elbow: [396, 360], hand: [374, 356] })}
      </g>
    </svg>`,

  // How to apologize: he offers a small bouquet with a sheepish face; she's arms crossed but smiling.
  apology: () => `
    <svg width="560" height="400" viewBox="70 110 500 363" fill="none">
      <defs>${figureDefs('ap')}</defs>
      <g mask="url(#apFade)">
        ${bust({ px: 'ap', cx: 200, skin: 'A', shirt: '#8EC5FF', tilt: 6, eyes: 'right', mouth: 'smirk', brows: 'sly' })}
        <path d="M156 352c28-16 62-16 90 2" stroke="url(#apA)" stroke-width="20" stroke-linecap="round"/>
        <path d="M160 370c30 12 60 10 86-8" stroke="#F2BE9C" stroke-width="20" stroke-linecap="round"/>
        ${bust({ px: 'ap', cx: 440, skin: 'B', shirt: '#FFE7A0', hair: 'short', tilt: -8, eyes: 'left', mouth: 'flat', brows: 'raised' })}
        <path d="M334 340l-10-46M334 340l2-50M334 340l14-44" stroke="#22B36B" stroke-width="5" stroke-linecap="round"/>
        <circle cx="322" cy="286" r="15" fill="#FF4D6D"/><circle cx="338" cy="278" r="15" fill="#FF9EC4"/><circle cx="352" cy="292" r="14" fill="#FFD93D"/>
        <circle cx="326" cy="286" r="5" fill="#FFE7A0"/><circle cx="338" cy="278" r="5" fill="#FFE7A0"/><circle cx="352" cy="292" r="5" fill="#FF4D6D"/>
        <path d="M318 330l32 0-8 22h-16z" fill="#FFFFFF"/>
        ${arm({ px: 'ap', skin: 'B', sleeve: '#FFE7A0', from: [406, 324], elbow: [392, 352], hand: [346, 342] })}
      </g>
    </svg>`,
  // Trivia: she holds up a quiz card, he scratches his head thinking.
  trivia: ({ card }) => `
    <svg width="560" height="410" viewBox="70 100 500 373" fill="none">
      <defs>${figureDefs('tv')}</defs>
      <g mask="url(#tvFade)">
        ${bust({ px: 'tv', cx: 200, skin: 'A', shirt: '#FFE7A0', tilt: 6, eyes: 'right', mouth: 'smirk', brows: 'sly' })}
        ${bust({ px: 'tv', cx: 440, skin: 'B', shirt: '#2D2952', hair: 'short', tilt: -8, eyes: 'left', mouth: 'flat', brows: 'raised' })}
        <g transform="rotate(8 300 216)"><rect x="262" y="166" width="80" height="104" rx="10" fill="${card}"/>
          <text x="302" y="238" text-anchor="middle" font-family="Serif" font-size="64" fill="#D93556">?</text></g>
        ${arm({ px: 'tv', skin: 'A', sleeve: '#FFE7A0', from: [228, 326], elbow: [236, 352], hand: [286, 262] })}
        ${arm({ px: 'tv', skin: 'B', sleeve: '#2D2952', from: [412, 326], elbow: [404, 356], hand: [432, 272] })}
      </g>
    </svg>`,

  // Stopped / started: a green U-turn road sign between them, both looking up at it.
  uturn: () => `
    <svg width="540" height="430" viewBox="70 60 500 413" fill="none">
      <defs>${figureDefs('ut')}</defs>
      <rect x="314" y="150" width="12" height="320" rx="6" fill="#B8BCC6"/>
      <rect x="250" y="70" width="140" height="120" rx="18" fill="#0B8A62"/>
      <rect x="258" y="78" width="124" height="104" rx="12" stroke="#FFFFFF" stroke-width="5"/>
      <path d="M348 168v-50a22 22 0 0 0-44 0v34M290 136l14 18 14-18" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <g mask="url(#utFade)">
        ${bust({ px: 'ut', cx: 200, skin: 'A', shirt: '#FFFFFF', tilt: 10, eyes: 'right', mouth: 'smile' })}
        ${bust({ px: 'ut', cx: 440, skin: 'B', shirt: '#FFD93D', hair: 'short', tilt: -10, eyes: 'left', mouth: 'smile' })}
      </g>
    </svg>`,

  // Phone-free dinner: each cracking a fortune cookie, reading the little slip.
  fortunes: ({ card }) => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>${figureDefs('fo')}</defs>
      <g mask="url(#foFade)">
        ${bust({ px: 'fo', cx: 200, skin: 'A', shirt: '#FF4D6D', tilt: 4, eyes: 'right', mouth: 'smile' })}
        ${bust({ px: 'fo', cx: 440, skin: 'B', shirt: '#3A3A3C', hair: 'short', tilt: -4, eyes: 'left', mouth: 'grin' })}
        <path d="M244 352c4-22 22-32 36-28-6 12-6 26-2 38-14 2-26 0-34-10z" fill="#E9A84C"/>
        <rect x="266" y="318" width="44" height="16" rx="2" fill="${card}" transform="rotate(-24 288 326)"/>
        ${arm({ px: 'fo', skin: 'A', sleeve: '#FF4D6D', from: [234, 324], elbow: [240, 364], hand: [262, 352] })}
        <path d="M396 352c-4-22-22-32-36-28 6 12 6 26 2 38 14 2 26 0 34-10z" fill="#E09A3E"/>
        <rect x="330" y="318" width="44" height="16" rx="2" fill="${card}" transform="rotate(24 352 326)"/>
        ${arm({ px: 'fo', skin: 'B', sleeve: '#3A3A3C', from: [406, 324], elbow: [400, 364], hand: [378, 352] })}
      </g>
    </svg>`,

  // Myths busted: reading the newspaper together, eyebrows raised at the headline.
  newspaper: () => `
    <svg width="560" height="384" viewBox="70 130 500 343" fill="none">
      <defs>${figureDefs('nz')}</defs>
      <g mask="url(#nzFade)">
        ${bust({ px: 'nz', cx: 220, skin: 'A', shirt: '#2E5BFF', tilt: 6, eyes: 'wide', mouth: 'o', brows: 'raised' })}
        ${bust({ px: 'nz', cx: 420, skin: 'B', shirt: '#FFFFFF', hair: 'short', tilt: -6, eyes: 'left', mouth: 'smirk', brows: 'raised' })}
        <g transform="rotate(-2 320 380)">
          <rect x="176" y="318" width="288" height="150" fill="#F4F0E6"/>
          <path d="M320 318v150" stroke="#D9D2C2" stroke-width="3"/>
          <rect x="194" y="332" width="110" height="14" fill="#1A1A1A"/><rect x="336" y="332" width="110" height="14" fill="#1A1A1A"/>
          <path d="M194 362h110M194 376h96M194 390h104M336 362h110M336 376h90M336 390h100" stroke="#9A9486" stroke-width="5" stroke-linecap="round"/>
          <rect x="350" y="404" width="80" height="30" rx="4" stroke="#D93556" stroke-width="4" transform="rotate(-10 390 419)"/>
        </g>
        <circle cx="182" cy="326" r="11" fill="#EDB894"/><circle cx="458" cy="322" r="11" fill="#93603F"/>
      </g>
    </svg>`,
  // Weekly check-in: side by side with mugs, a little sun peeking from behind a cloud above them.
  checkin: ({ card }) => `
    <svg width="540" height="440" viewBox="70 60 500 413" fill="none">
      <defs>${figureDefs('ci')}</defs>
      <circle cx="392" cy="96" r="40" fill="#FFE7A0"/>
      <path d="M250 170h130a34 34 0 0 0 0-68 50 50 0 0 0-96-8 38 38 0 0 0-34 76z" fill="${card}"/>
      <g mask="url(#ciFade)">
        ${bust({ px: 'ci', cx: 220, skin: 'A', shirt: '#FF9EC4', tilt: 8, eyes: 'happy', mouth: 'smile' })}
        ${bust({ px: 'ci', cx: 420, skin: 'B', shirt: '#2F9E77', hair: 'short', tilt: -8, eyes: 'left', mouth: 'smile' })}
        <path d="M244 350h36l-4 42h-28z" fill="#FFE7A0"/><path d="M280 358q12 0 12 10t-12 10" stroke="#FFE7A0" stroke-width="5"/>
        ${arm({ px: 'ci', skin: 'A', sleeve: '#FF9EC4', from: [228, 326], elbow: [232, 364], hand: [256, 370] })}
        <path d="M396 350h-36l4 42h28z" fill="${card}"/><path d="M360 358q-12 0-12 10t12 10" stroke="${card}" stroke-width="5"/>
        ${arm({ px: 'ci', skin: 'B', sleeve: '#2F9E77', from: [412, 326], elbow: [408, 364], hand: [384, 370] })}
      </g>
    </svg>`,
};

// Small flat "photos" for polaroid cards, drawn in a 400×320 box.
export const POLAROID_ART = {
  fort: () => `
    <svg viewBox="0 0 400 320" fill="none">
      <path d="M40 60Q200 110 360 60" stroke="#1A1A1A" stroke-width="3"/>
      <circle cx="90" cy="82" r="8" fill="#FFD93D"/><circle cx="150" cy="94" r="8" fill="#FFD93D"/>
      <circle cx="210" cy="98" r="8" fill="#FFD93D"/><circle cx="270" cy="92" r="8" fill="#FFD93D"/><circle cx="320" cy="80" r="8" fill="#FFD93D"/>
      <path d="M90 280l110-170 110 170z" fill="#FF4D6D"/>
      <path d="M200 110l-30 170h60z" fill="#FFF6DD"/>
      <rect x="60" y="278" width="280" height="10" rx="5" fill="#1A1A1A" opacity=".15"/>
    </svg>`,
  cookoff: () => `
    <svg viewBox="0 0 400 320" fill="none">
      <path d="M160 90q-12-16 0-32t0-32M200 90q-12-16 0-32t0-32M240 90q-12-16 0-32t0-32" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
      <rect x="104" y="110" width="192" height="22" rx="11" fill="#1A1A1A"/>
      <rect x="186" y="96" width="28" height="18" rx="6" fill="#1A1A1A"/>
      <path d="M116 132h168v86c0 28-22 50-50 50h-68c-28 0-50-22-50-50z" fill="#FF4D6D"/>
      <rect x="70" y="150" width="50" height="18" rx="9" fill="#1A1A1A"/><rect x="280" y="150" width="50" height="18" rx="9" fill="#1A1A1A"/>
      <path d="M300 60l-70 120" stroke="#B5763F" stroke-width="10" stroke-linecap="round"/>
      <ellipse cx="306" cy="50" rx="14" ry="20" transform="rotate(30 306 50)" fill="#B5763F"/>
    </svg>`,
  coffee: () => `
    <svg viewBox="0 0 400 320" fill="none">
      <rect x="40" y="250" width="320" height="10" rx="5" fill="#1A1A1A" opacity=".15"/>
      <path d="M60 170h72l-8 80H68z" fill="#FFFFFF"/><ellipse cx="96" cy="170" rx="36" ry="8" fill="#6B3A22"/>
      <path d="M164 140h80l-9 110h-62z" fill="#FFFFFF"/><ellipse cx="204" cy="140" rx="40" ry="9" fill="#6B3A22"/>
      <path d="M190 138c4-6 10-6 14 0 4-6 10-6 14 0-6 8-14 12-14 12s-8-4-14-12z" fill="#FFE7A0"/>
      <path d="M278 186h64l-7 64h-50z" fill="#FFFFFF"/><ellipse cx="310" cy="186" rx="32" ry="7" fill="#6B3A22"/>
      <path d="M136 196h1M248 170h1" stroke="#1A1A1A"/>
      <path d="M204 112q-10-14 0-28t0-28" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
    </svg>`,
  sunset: () => `
    <svg viewBox="0 0 400 320" fill="none">
      <circle cx="200" cy="190" r="80" fill="#FF4D6D"/>
      <path d="M0 200c60-30 120-30 200 0s140 30 200 0v120H0z" fill="#FF8A65"/>
      <path d="M0 240c80-26 150-26 220 0s130 22 180 4v76H0z" fill="#B8441E"/>
      <path d="M150 320c20-30 50-56 90-76" stroke="#FFE7A0" stroke-width="10" stroke-linecap="round" stroke-dasharray="2 22"/>
      <rect x="276" y="196" width="26" height="54" rx="10" fill="#1A1A1A"/><rect x="280" y="186" width="18" height="14" rx="4" fill="#FFFFFF"/>
    </svg>`,
  bake: () => `
    <svg viewBox="0 0 400 320" fill="none">
      <rect x="70" y="260" width="260" height="12" rx="6" fill="#1A1A1A" opacity=".15"/>
      <g transform="rotate(-6 200 200)">
        <rect x="110" y="196" width="180" height="64" rx="10" fill="#B5763F"/>
        <rect x="120" y="140" width="160" height="58" rx="10" fill="#FFD9CC"/>
        <path d="M118 140h164v18c-12 0-12 16-24 16s-12-16-24-16-12 22-24 22-12-22-24-22-12 16-24 16-12-16-24-16-12 10-20 10z" fill="#FFFFFF"/>
        <rect x="194" y="96" width="12" height="44" rx="4" fill="#FF4D6D"/>
        <path d="M200 70c10 10 10 22 0 26-10-4-10-16 0-26z" fill="#FFD93D"/>
      </g>
    </svg>`,
  vinyl: () => `
    <svg viewBox="0 0 400 320" fill="none">
      <circle cx="200" cy="160" r="120" fill="#1A1A1A"/>
      <circle cx="200" cy="160" r="96" stroke="#3A3A3A" stroke-width="3"/>
      <circle cx="200" cy="160" r="76" stroke="#3A3A3A" stroke-width="3"/>
      <circle cx="200" cy="160" r="40" fill="#FF4D6D"/>
      <circle cx="200" cy="160" r="6" fill="#FFFFFF"/>
      <path d="M150 90a90 90 0 0 1 60-12" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="6" stroke-linecap="round"/>
      <path d="M330 40l-40 110" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>
      <rect x="276" y="140" width="28" height="22" rx="5" fill="#FFFFFF" transform="rotate(20 290 151)"/>
    </svg>`,
};

// ---- Duo covers: the couple side by side with a topic object floating between their heads. ----
// Objects are drawn in a box centered on (320, 240), roughly ±70 wide and ±80 tall.
const PROPS = {
  window: () => `<rect x="258" y="170" width="124" height="140" rx="10" fill="#8EC5FF"/><rect x="258" y="170" width="124" height="140" rx="10" stroke="#FFFFFF" stroke-width="10"/><path d="M320 170v140M258 240h124" stroke="#FFFFFF" stroke-width="8"/>${[[282, 196], [348, 206], [300, 262], [362, 278], [276, 288]].map(([x, y]) => `<path d="M${x} ${y}c-5 7-7 11-7 14a7 7 0 0 0 14 0c0-3-2-7-7-14z" fill="#FFFFFF" opacity=".85"/>`).join('')}`,
  podium: () => `<rect x="296" y="220" width="48" height="90" rx="4" fill="#FFD93D"/><rect x="248" y="250" width="48" height="60" rx="4" fill="#C9CDD6"/><rect x="344" y="268" width="48" height="42" rx="4" fill="#E0A868"/><text x="320" y="256" text-anchor="middle" font-family="Serif" font-size="30" fill="#1A1A1A">1</text><text x="272" y="284" text-anchor="middle" font-family="Serif" font-size="26" fill="#1A1A1A">2</text><text x="368" y="296" text-anchor="middle" font-family="Serif" font-size="24" fill="#1A1A1A">3</text><path d="M320 214c-10-7-14-12-14-17a6 6 0 0 1 14-3 6 6 0 0 1 14 3c0 5-4 10-14 17z" fill="#FF4D6D"/>`,
  dice: () => `<g transform="rotate(-12 290 250)"><rect x="252" y="212" width="76" height="76" rx="16" fill="#FFFFFF"/>${[[272, 232], [308, 268], [290, 250]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#5E4CCB"/>`).join('')}</g><g transform="rotate(14 352 214)"><rect x="318" y="180" width="68" height="68" rx="14" fill="#FFE7A0"/>${[[336, 198], [368, 198], [336, 230], [368, 230]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#5E4CCB"/>`).join('')}</g>`,
  trophy: () => `<path d="M282 180h76v34a38 38 0 0 1-76 0z" fill="#FFD93D"/><path d="M282 190h-18a18 18 0 0 0 18 30M358 190h18a18 18 0 0 1-18 30" stroke="#FFD93D" stroke-width="8" fill="none"/><rect x="312" y="250" width="16" height="28" fill="#FFD93D"/><rect x="290" y="276" width="60" height="16" rx="4" fill="#E7B800"/><path d="M320 196l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill="#FFFFFF"/>`,
  clipboard: () => `<rect x="266" y="170" width="108" height="146" rx="10" fill="#FFFFFF"/><rect x="298" y="160" width="44" height="22" rx="6" fill="#5E4CCB"/>${['A', 'B', 'C', 'D'].map((l, i) => `<circle cx="290" cy="${204 + i * 28}" r="9" stroke="#5E4CCB" stroke-width="3" fill="${i === 1 ? '#5E4CCB' : 'none'}"/><path d="M308 ${204 + i * 28}h48" stroke="#C3B1FF" stroke-width="5" stroke-linecap="round"/>`).join('')}`,
  mugnote: () => `<path d="M284 224h60l-6 72h-48z" fill="#FF4D6D"/><path d="M344 236q20 0 20 18t-20 18" stroke="#FF4D6D" stroke-width="8" fill="none"/><g transform="rotate(-8 314 196)"><rect x="284" y="168" width="64" height="54" rx="4" fill="#FFF6D6"/><path d="M316 204c-9-6-13-10-13-15a6 6 0 0 1 13-3 6 6 0 0 1 13 3c0 5-4 9-13 15z" fill="#FF4D6D"/></g>`,
  bigstar: () => `<path d="M320 166l20 44 48 6-35 32 9 48-42-24-42 24 9-48-35-32 48-6z" fill="#FFD93D" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round"/>`,
  moonstars: () => `<defs><mask id="dmn"><rect width="640" height="480" fill="#fff"/><circle cx="342" cy="214" r="40" fill="#000"/></mask></defs><circle cx="316" cy="236" r="48" fill="#FFE7A0" mask="url(#dmn)"/><path d="M370 186l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#FFE7A0"/>`,
  hearts: () => `<path d="M320 312c-46-32-70-56-70-84 0-22 16-38 36-38 14 0 26 8 34 20 8-12 20-20 34-20 20 0 36 16 36 38 0 28-24 52-70 84z" fill="#FF4D6D"/><path d="M376 196c-12-8-18-14-18-21a9 9 0 0 1 18-4 9 9 0 0 1 18 4c0 7-6 13-18 21z" fill="#FFFFFF"/>`,
  calendar: () => `<rect x="258" y="176" width="124" height="128" rx="14" fill="#FFFFFF"/><rect x="258" y="176" width="124" height="34" rx="14" fill="#2E5BFF"/><rect x="258" y="196" width="124" height="14" fill="#2E5BFF"/><path d="M286 166v22M354 166v22" stroke="#1A1A1A" stroke-width="7" stroke-linecap="round"/>${[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => `<rect x="${272 + c * 26}" y="${222 + r * 20}" width="16" height="12" rx="3" fill="${r === 1 && c === 2 ? '#FF4D6D' : '#DCEBFF'}"/>`).join('')).join('')}`,
  popcorn: () => `<path d="M278 214h84l-12 98h-60z" fill="#FFFFFF"/><path d="M290 214l6 98M320 214v98M350 214l-6 98" stroke="#D93556" stroke-width="10"/>${[[284, 204], [302, 192], [322, 186], [342, 194], [358, 206], [296, 210], [338, 210], [318, 200]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill="#FFF6D6"/>`).join('')}`,
  phone: () => `<rect x="276" y="166" width="88" height="156" rx="16" fill="#1F1B3A"/><rect x="284" y="180" width="72" height="128" rx="8" fill="#DCEBFF"/><rect x="292" y="212" width="56" height="34" rx="12" fill="#FFFFFF"/><path d="M320 238c-7-5-10-8-10-12a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 4-3 7-10 12z" fill="#FF4D6D"/>`,
  flowerpot: () => `<path d="M290 260h60l-8 54h-44z" fill="#E0A868"/><path d="M320 260v-50" stroke="#2F9E77" stroke-width="6"/><path d="M320 236c-18 0-24-12-24-18 12 0 24 6 24 18zM320 230c18 0 24-12 24-18-12 0-24 6-24 18z" fill="#2F9E77"/>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="320" cy="180" rx="10" ry="18" fill="#FF9EC4" transform="rotate(${a} 320 196)"/>`).join('')}<circle cx="320" cy="196" r="9" fill="#FFD93D"/>`,
  spinner: () => `${['#FF4D6D', '#FFD93D', '#88E3B5', '#8EC5FF', '#C3B1FF', '#FFB38A'].map((c, i) => { const a0 = (i * 60 - 90) * Math.PI / 180, a1 = ((i + 1) * 60 - 90) * Math.PI / 180; return `<path d="M320 244L${320 + 64 * Math.cos(a0)} ${244 + 64 * Math.sin(a0)}A64 64 0 0 1 ${320 + 64 * Math.cos(a1)} ${244 + 64 * Math.sin(a1)}z" fill="${c}"/>`; }).join('')}<circle cx="320" cy="244" r="10" fill="#FFFFFF"/><path d="M310 166h20l-10 18z" fill="#3A1C10"/>`,
  tape: () => `<rect x="250" y="196" width="140" height="92" rx="12" fill="#2A2A2E"/><rect x="262" y="206" width="116" height="40" rx="6" fill="#FFF6E5"/><circle cx="292" cy="262" r="14" fill="#FFFFFF"/><circle cx="348" cy="262" r="14" fill="#FFFFFF"/><circle cx="292" cy="262" r="6" fill="#2A2A2E"/><circle cx="348" cy="262" r="6" fill="#2A2A2E"/><path d="M272 222h96" stroke="#FF4D6D" stroke-width="5" stroke-linecap="round"/>`,
  warning: () => `<path d="M320 170l72 126H248z" fill="#FFD93D" stroke="#1A1A1A" stroke-width="8" stroke-linejoin="round"/><rect x="313" y="212" width="14" height="44" rx="7" fill="#1A1A1A"/><circle cx="320" cy="274" r="8" fill="#1A1A1A"/>`,
  gift: () => `<rect x="266" y="222" width="108" height="86" rx="8" fill="#FF4D6D"/><rect x="258" y="200" width="124" height="28" rx="6" fill="#D93556"/><rect x="312" y="200" width="16" height="108" fill="#FFE7A0"/><path d="M320 200c-10-26-40-26-36-8 2 8 20 10 36 8zM320 200c10-26 40-26 36-8-2 8-20 10-36 8z" fill="#FFE7A0"/>`,
  match: () => `<g transform="rotate(18 320 250)"><rect x="314" y="214" width="12" height="104" rx="4" fill="#E9C793"/><circle cx="320" cy="210" r="13" fill="#C2185B"/><path d="M320 152c18 18 20 38 0 50-20-12-18-32 0-50z" fill="#FFB020"/><path d="M320 172c9 9 10 20 0 26-10-6-9-17 0-26z" fill="#FFE7A0"/></g>`,
  ratecard: () => `<rect x="250" y="200" width="140" height="80" rx="16" fill="#FFFFFF"/>${[0, 1, 2, 3, 4].map((i) => `<path d="M${270 + i * 25} 228l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="${i < 4 ? '#FFD93D' : '#DCDDE6'}"/>`).join('')}<path d="M270 262h100" stroke="#DCEBFF" stroke-width="6" stroke-linecap="round"/>`,
  jar: () => `<rect x="284" y="168" width="72" height="20" rx="5" fill="#C3B1FF"/><path d="M276 190h88v104a14 14 0 0 1-14 14h-60a14 14 0 0 1-14-14z" fill="#FFFFFF" fill-opacity=".55" stroke="#FFFFFF" stroke-width="5"/><rect x="290" y="252" width="26" height="40" rx="3" fill="#FF9EC4"/><rect x="318" y="262" width="30" height="30" rx="3" fill="#FFB38A"/><path d="M296 220h48" stroke="#5E4CCB" stroke-width="5" stroke-linecap="round"/>`,
  haha: () => `<path d="M256 180h76a14 14 0 0 1 14 14v32a14 14 0 0 1-14 14h-46l-18 16v-16h-12a14 14 0 0 1-14-14v-32a14 14 0 0 1 14-14z" fill="#FFFFFF" stroke="#1A1A1A" stroke-width="5"/><text x="294" y="218" text-anchor="middle" font-family="Inter" font-weight="800" font-size="24" fill="#1A1A1A">HAHA</text><path d="M330 242h52a12 12 0 0 1 12 12v24a12 12 0 0 1-12 12h-8v14l-14-14h-30a12 12 0 0 1-12-12v-24a12 12 0 0 1 12-12z" fill="#FFD93D" stroke="#1A1A1A" stroke-width="5"/><text x="356" y="274" text-anchor="middle" font-family="Inter" font-weight="800" font-size="18" fill="#1A1A1A">LOL</text>`,
  rocket: () => `<g transform="rotate(30 320 240)"><path d="M320 160c22 18 30 46 26 82h-52c-4-36 4-64 26-82z" fill="#FFFFFF"/><circle cx="320" cy="200" r="12" fill="#8EC5FF" stroke="#1F1B3A" stroke-width="4"/><path d="M294 226l-16 30 18-4zM346 226l16 30-18-4z" fill="#FF4D6D"/><path d="M306 244c4 18 8 28 14 40 6-12 10-22 14-40z" fill="#FFB020"/></g>`,
  stopwatch: () => `<rect x="308" y="166" width="24" height="16" rx="4" fill="#FFFFFF"/><circle cx="320" cy="244" r="58" fill="#FFFFFF" stroke="#3A1C10" stroke-width="7"/><path d="M320 244v-38" stroke="#D93556" stroke-width="7" stroke-linecap="round"/><path d="M320 244l22 14" stroke="#3A1C10" stroke-width="6" stroke-linecap="round"/>`,
  clock: () => `<circle cx="320" cy="240" r="64" fill="#FFFFFF" stroke="#1D5BD8" stroke-width="8"/>${Array.from({ length: 12 }, (_, i) => `<path d="M320 182v8" stroke="#0F1E4A" stroke-width="4" stroke-linecap="round" transform="rotate(${i * 30} 320 240)"/>`).join('')}<path d="M320 240v-34" stroke="#0F1E4A" stroke-width="7" stroke-linecap="round"/><path d="M320 240l26 12" stroke="#1D5BD8" stroke-width="5" stroke-linecap="round"/>`,
  house: () => `<path d="M320 170l70 56v84H250v-84z" fill="#FFFFFF"/><path d="M240 232l80-66 80 66" stroke="#2F9E77" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="302" y="258" width="36" height="52" rx="6" fill="#2F9E77"/><rect x="266" y="246" width="26" height="26" rx="4" fill="#FFE7A0"/><rect x="348" y="246" width="26" height="26" rx="4" fill="#FFE7A0"/>`,
  bed: () => `<rect x="244" y="230" width="152" height="70" rx="12" fill="#FFFFFF"/><rect x="244" y="200" width="20" height="100" rx="8" fill="#C3B1FF"/><rect x="270" y="214" width="44" height="22" rx="10" fill="#EDE7FF"/><path d="M262 258h134v42H262z" fill="#C3B1FF" opacity=".7"/><text x="352" y="210" font-family="Serif" font-size="32" fill="#FFFFFF">z</text><text x="372" y="190" font-family="Serif" font-size="24" fill="#FFFFFF">z</text>`,
  rosette: () => `${Array.from({ length: 16 }, (_, i) => `<circle cx="320" cy="180" r="12" fill="#FFD93D" transform="rotate(${i * 22.5} 320 222)"/>`).join('')}<circle cx="320" cy="222" r="38" fill="#FFD93D"/><circle cx="320" cy="222" r="28" fill="#FFFFFF"/><path d="M302 254l-12 60 18-10 10 16 4-62zM338 254l12 60-18-10-10 16-4-62z" fill="#C2185B"/><path d="M320 238c-10-7-14-11-14-16a6 6 0 0 1 14-3 6 6 0 0 1 14 3c0 5-4 9-14 16z" fill="#C2185B"/>`,
  car: () => `<path d="M256 258l14-34a16 16 0 0 1 15-10h70a16 16 0 0 1 15 10l14 34z" fill="#FF4D6D"/><rect x="246" y="252" width="148" height="40" rx="14" fill="#FF4D6D"/><path d="M280 248l10-24h60l10 24z" fill="#DCEBFF"/><circle cx="280" cy="294" r="16" fill="#1A1A1A"/><circle cx="360" cy="294" r="16" fill="#1A1A1A"/><circle cx="280" cy="294" r="6" fill="#C9CDD6"/><circle cx="360" cy="294" r="6" fill="#C9CDD6"/>`,
  headphones: () => `<path d="M262 260v-24a58 58 0 0 1 116 0v24" stroke="#FFFFFF" stroke-width="12" fill="none"/><rect x="248" y="246" width="32" height="56" rx="14" fill="#FF6F8E"/><rect x="360" y="246" width="32" height="56" rx="14" fill="#FF6F8E"/>`,
  thermometer: () => `<rect x="306" y="168" width="28" height="118" rx="14" fill="#FFFFFF" stroke="#3A1C10" stroke-width="5"/><circle cx="320" cy="296" r="22" fill="#FF4D6D" stroke="#3A1C10" stroke-width="5"/><rect x="313" y="210" width="14" height="80" fill="#FF4D6D"/>`,
  doorhanger: () => `<g transform="rotate(-6 320 240)"><path d="M280 168h80v150a10 10 0 0 1-10 10h-60a10 10 0 0 1-10-10z" fill="#FFFFFF"/><circle cx="320" cy="196" r="20" fill="#DCD1FF"/><path d="M320 216v14" stroke="#DCD1FF" stroke-width="10"/><path d="M296 262h48M300 280h40" stroke="#5E4CCB" stroke-width="6" stroke-linecap="round"/></g>`,
  candle: () => `<path d="M320 160c14 16 16 32 0 44-16-12-14-28 0-44z" fill="#FFB020"/><path d="M320 176c7 8 8 18 0 24-8-6-7-16 0-24z" fill="#FFE7A0"/><path d="M320 204v12" stroke="#FFFFFF" stroke-width="3"/><path d="M280 216h80v80a12 12 0 0 1-12 12h-56a12 12 0 0 1-12-12z" fill="#FFF4E0"/><rect x="292" y="240" width="56" height="34" rx="5" fill="#FF4D6D"/>`,
  gloves: () => `<g transform="rotate(-14 286 240)"><rect x="252" y="196" width="66" height="78" rx="30" fill="#D93556"/><rect x="262" y="270" width="46" height="26" rx="6" fill="#FFFFFF"/></g><g transform="rotate(14 354 240)"><rect x="322" y="196" width="66" height="78" rx="30" fill="#2E5BFF"/><rect x="332" y="270" width="46" height="26" rx="6" fill="#FFFFFF"/></g>`,
  scroll: () => `<rect x="262" y="176" width="116" height="132" rx="6" fill="#FFFDF7"/><rect x="254" y="168" width="132" height="18" rx="9" fill="#E0A868"/><rect x="254" y="298" width="132" height="18" rx="9" fill="#E0A868"/><path d="M280 206h80M280 224h70M280 242h76" stroke="#C9C1B0" stroke-width="5" stroke-linecap="round"/><path d="M282 280c12-12 20 8 30-2s16 6 26-4" stroke="#1F1B3A" stroke-width="4" stroke-linecap="round" fill="none"/>`,
};
export function duo(px, prop, a = {}, b = {}) {
  return `
    <svg width="560" height="396" viewBox="70 120 500 353" fill="none">
      <defs>${figureDefs(px)}</defs>
      <g mask="url(#${px}Fade)">
        ${bust({ px, cx: 200, skin: 'A', shirt: '#FF9EC4', tilt: 6, eyes: 'happy', mouth: 'smile', ...a })}
        ${bust({ px, cx: 440, skin: 'B', shirt: '#FFFFFF', hair: 'short', tilt: -6, eyes: 'left', mouth: 'smile', ...b })}
      </g>
      <g transform="translate(320 236) scale(1.18) translate(-320 -240)">${PROPS[prop]()}</g>
    </svg>`;
}

Object.assign(ILLUSTRATIONS, {
  d6_2: () => duo('d6_2', 'window', {"shirt": "#FFE7A0", "eyes": "right"}, {"shirt": "#1D5BD8", "eyes": "left"}),
  d6_3: () => duo('d6_3', 'hearts', {"shirt": "#FFE7A0", "eyes": "right", "mouth": "grin"}, {"shirt": "#2D2952", "eyes": "left", "mouth": "smirk", "brows": "raised"}),
  d6_4: () => duo('d6_4', 'dice', {"shirt": "#FFD93D", "eyes": "right"}, {"shirt": "#FFFFFF", "eyes": "left", "mouth": "grin"}),
  d6_5: () => duo('d6_5', 'trophy', {"shirt": "#FF4D6D", "eyes": "happy", "mouth": "grin"}, {"shirt": "#FFE7A0", "eyes": "happy", "mouth": "grin"}),
  d7_2: () => duo('d7_2', 'clipboard', {"shirt": "#5E4CCB", "eyes": "right", "mouth": "smile"}, {"shirt": "#FFFFFF", "eyes": "left", "mouth": "flat", "brows": "raised"}),
  d7_3: () => duo('d7_3', 'mugnote', {"shirt": "#FF4D6D", "eyes": "right"}, {"shirt": "#8EC5FF", "eyes": "left", "mouth": "grin"}),
  d7_4: () => duo('d7_4', 'bigstar', {"shirt": "#FFD93D", "eyes": "happy"}, {"shirt": "#FF4D6D", "eyes": "happy", "mouth": "grin"}),
  d7_5: () => duo('d7_5', 'moonstars', {"shirt": "#C3B1FF", "eyes": "closed"}, {"shirt": "#8EC5FF", "eyes": "closed"}),
  d8_2: () => duo('d8_2', 'calendar', {"shirt": "#1A1A1A", "eyes": "right", "mouth": "grin"}, {"shirt": "#FF4D6D", "eyes": "left", "mouth": "smile"}),
  d8_3: () => duo('d8_3', 'phone', {"shirt": "#FFE7A0", "eyes": "right", "mouth": "grin"}, {"shirt": "#FFFFFF", "eyes": "happy"}),
  d8_4: () => duo('d8_4', 'flowerpot', {"shirt": "#FF9EC4", "eyes": "happy"}, {"shirt": "#2F9E77", "eyes": "left"}),
  d8_5: () => duo('d8_5', 'spinner', {"shirt": "#8EC5FF", "eyes": "right", "mouth": "smirk"}, {"shirt": "#FFE7A0", "eyes": "left", "mouth": "flat", "brows": "raised"}),
  d9_2: () => duo('d9_2', 'tape', {"shirt": "#FFE7A0", "eyes": "right"}, {"shirt": "#2A2A2E", "eyes": "happy", "mouth": "grin"}),
  d9_3: () => duo('d9_3', 'warning', {"shirt": "#FF4D6D", "eyes": "wide", "mouth": "o", "brows": "raised"}, {"shirt": "#1F1B3A", "eyes": "left", "mouth": "flat"}),
  d9_4: () => duo('d9_4', 'gift', {"shirt": "#FFFFFF", "eyes": "happy", "mouth": "grin"}, {"shirt": "#9E1240", "eyes": "wide", "mouth": "o"}),
  d9_5: () => duo('d9_5', 'match', {"shirt": "#C2185B", "eyes": "right", "mouth": "smile"}, {"shirt": "#FFE7A0", "eyes": "left", "mouth": "smirk"}),
  d10_2: () => duo('d10_2', 'ratecard', {"shirt": "#FFD93D", "eyes": "right", "mouth": "smirk"}, {"shirt": "#FF4D6D", "eyes": "left", "mouth": "grin"}),
  d10_3: () => duo('d10_3', 'jar', {"shirt": "#5E4CCB", "eyes": "right"}, {"shirt": "#FFFFFF", "eyes": "left"}),
  d10_4: () => duo('d10_4', 'haha', {"shirt": "#2E5BFF", "eyes": "happy", "mouth": "grin"}, {"shirt": "#FF4D6D", "eyes": "happy", "mouth": "grin"}),
  d10_5: () => duo('d10_5', 'rocket', {"shirt": "#FFE7A0", "eyes": "right", "mouth": "grin"}, {"shirt": "#FF4D6D", "eyes": "left", "mouth": "smile"}),
  d11_2: () => duo('d11_2', 'stopwatch', {"shirt": "#B8441E", "eyes": "wide", "mouth": "o", "brows": "raised"}, {"shirt": "#FFFFFF", "eyes": "left", "mouth": "grin"}),
  d11_3: () => duo('d11_3', 'clock', {"shirt": "#FFFFFF", "eyes": "happy"}, {"shirt": "#1D5BD8", "eyes": "happy"}),
  d11_4: () => duo('d11_4', 'house', {"shirt": "#FF9EC4", "eyes": "right"}, {"shirt": "#FFD93D", "eyes": "left", "mouth": "grin"}),
  d11_5: () => duo('d11_5', 'bed', {"shirt": "#FF9EC4", "eyes": "closed"}, {"shirt": "#2E5BFF", "eyes": "closed"}),
  d12_2: () => duo('d12_2', 'rosette', {"shirt": "#FFFFFF", "eyes": "happy", "mouth": "smile"}, {"shirt": "#9E1240", "eyes": "happy"}),
  d12_3: () => duo('d12_3', 'car', {"shirt": "#2E5BFF", "eyes": "right", "mouth": "grin"}, {"shirt": "#FF4D6D", "eyes": "left", "mouth": "grin"}),
  d12_4: () => duo('d12_4', 'headphones', {"shirt": "#FF6F8E", "eyes": "closed"}, {"shirt": "#FFE7A0", "eyes": "left"}),
  d12_5: () => duo('d12_5', 'thermometer', {"shirt": "#FFE7A0", "eyes": "left", "mouth": "flat"}, {"shirt": "#2D2952", "eyes": "right", "mouth": "flat"}),
  d13_2: () => duo('d13_2', 'doorhanger', {"shirt": "#5E4CCB", "eyes": "closed", "mouth": "smile"}, {"shirt": "#FFFFFF", "eyes": "closed"}),
  d13_3: () => duo('d13_3', 'candle', {"shirt": "#C2185B", "eyes": "right", "mouth": "smile"}, {"shirt": "#FFFFFF", "eyes": "left", "mouth": "smile"}),
  d13_4: () => duo('d13_4', 'gloves', {"shirt": "#D93556", "eyes": "right", "mouth": "smirk", "brows": "sly"}, {"shirt": "#2E5BFF", "eyes": "left", "mouth": "smirk", "brows": "sly"}),
  d13_5: () => duo('d13_5', 'scroll', {"shirt": "#FF4D6D", "eyes": "right", "mouth": "smile"}, {"shirt": "#1F1B3A", "eyes": "left", "mouth": "smile"}),
});
