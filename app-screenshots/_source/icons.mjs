// Alternate app icons, Snapchat+-style: the Moments mark (the flat-cut heart over two horizon
// lines and a dot) stays the silhouette, and each icon gives the heart a personality: a face,
// an accessory or an art style. Writes 1024 x 1024 RGB PNGs (no transparency, as Apple requires)
// to ../logo/alternate-icons, plus a preview sheet. Run: node AppStore/_source/icons.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'logo', 'alternate-icons');
const tmpDir = join(here, '.tmp-icons');

const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));
if (!chrome) throw new Error('No Chrome or Edge found for rendering');

// ---- The mark's geometry (assets/branding/moments-e8/icon-square.svg), in a 100 box ----
// The heart is cut flat at y 61.5, then the whole mark is lifted 6.59, so in the final box the
// heart spans about x 22-78, y 25-55 (centre ~ 50, 41) and the lines sit at y 59.8 and 66.3.
const HEART = 'M50 72 C34 61 26 52 26 42 C26 34 32 29 39 29 C44 29 48 32 50 36 C52 32 56 29 61 29 C68 29 74 34 74 42 C74 52 66 61 50 72 Z';
const HEART_T = 'translate(50 56) scale(1.18) translate(-50 -50)';

function heartMark({ heart, lines = heart, heartStyle = '', linesExtra = '' }) {
  return `<g transform="translate(0 -6.59)">
    <clipPath id="cut"><rect x="0" y="0" width="100" height="61.5"/></clipPath>
    <g clip-path="url(#cut)"><path d="${HEART}" transform="${HEART_T}" ${heartStyle || `fill="${heart}"`}/></g>
    <path d="M32.68 66.35 H67.32" stroke="${lines}" stroke-width="3.4" stroke-linecap="round" ${linesExtra}/>
    <path d="M39.66 72.91 H60.34" stroke="${lines}" stroke-width="3.4" stroke-linecap="round" ${linesExtra}/>
    <circle cx="50" cy="79.86" r="2.1" fill="${lines}" ${linesExtra}/>
  </g>`;
}

// ---- Face parts (final coordinates) ----
const eyes = (ink, glint = '#FFFFFF', y = 40) =>
  `<ellipse cx="43" cy="${y}" rx="2.5" ry="3.3" fill="${ink}"/><ellipse cx="57" cy="${y}" rx="2.5" ry="3.3" fill="${ink}"/>
   <circle cx="43.9" cy="${y - 1.2}" r="0.85" fill="${glint}"/><circle cx="57.9" cy="${y - 1.2}" r="0.85" fill="${glint}"/>`;
const smile = (ink, w = 1.8) => `<path d="M45.5 46.4 Q50 50.6 54.5 46.4" fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round"/>`;
const grin = (ink, tongue = '#FF8FA3') =>
  `<path d="M44.6 45.4 Q50 53.2 55.4 45.4 Z" fill="${ink}"/><path d="M47.2 49.6 Q50 52.2 52.8 49.6 Q50 48.4 47.2 49.6 Z" fill="${tongue}"/>`;
const cheeks = (c) => `<ellipse cx="37.6" cy="45.2" rx="2.7" ry="1.6" fill="${c}"/><ellipse cx="62.4" cy="45.2" rx="2.7" ry="1.6" fill="${c}"/>`;
const closedEye = (cx, ink, up = false) =>
  `<path d="M${cx - 2.8} 40.4 Q${cx} ${up ? 37.2 : 43.2} ${cx + 2.8} 40.4" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round"/>`;
const miniHeart = (x, y, s, fill) =>
  `<path d="${HEART}" fill="${fill}" transform="translate(${x} ${y}) scale(${s}) translate(-50 -50)"/>`;
const star = (cx, cy, r, fill, stroke) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="0.7" stroke-linejoin="round"/>`;
};

// ---- The icons ----
const INK = '#1A1A1A';
const VARIANTS = [
  {
    id: 'original', name: 'Original', tile: '#1F1B3A',
    art: () => heartMark({ heart: '#FF4D6D' }),
  },
  {
    id: 'happy', name: 'Happy', tile: '#1F1B3A',
    art: () => heartMark({ heart: '#FF4D6D' }) + eyes(INK) + smile(INK) + cheeks('#FFB3C2'),
  },
  {
    id: 'in-love', name: 'In love', tile: '#5E4CCB',
    art: () =>
      heartMark({ heart: '#FFFFFF' }) +
      miniHeart(43, 40, 0.16, '#FF4D6D') + miniHeart(57, 40, 0.16, '#FF4D6D') +
      grin(INK) + cheeks('#FFC2CF'),
  },
  {
    id: 'wink', name: 'Wink', tile: '#FF4D6D',
    art: () =>
      heartMark({ heart: '#FFFFFF' }) +
      `<ellipse cx="43" cy="40" rx="2.5" ry="3.3" fill="${INK}"/><circle cx="43.9" cy="38.8" r="0.85" fill="#fff"/>` +
      closedEye(57, INK, true) + grin(INK) + cheeks('#FFB3C2'),
  },
  {
    id: 'sleepy', name: 'Sleepy', tile: '#000000',
    art: () =>
      heartMark({ heart: '#FF4D6D' }) + closedEye(43, INK) + closedEye(57, INK) +
      `<ellipse cx="50" cy="47.6" rx="1.6" ry="1.9" fill="${INK}"/>` + cheeks('#FFB3C2') +
      `<text x="70" y="23" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="8" fill="#FFFFFF">z</text>
       <text x="77" y="15" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="6" fill="#FFFFFF" opacity="0.7">z</text>`,
  },
  {
    id: 'cool', name: 'Cool', tile: '#EE633C',
    art: () =>
      heartMark({ heart: '#FFE7A0' }) +
      `<path d="M36.5 37.2 H48 Q48.4 43.6 42.4 43.8 Q36.6 43.6 36.5 37.2 Z" fill="${INK}"/>
       <path d="M52 37.2 H63.5 Q63.4 43.6 57.6 43.8 Q51.6 43.6 52 37.2 Z" fill="${INK}"/>
       <path d="M48 38.2 H52" stroke="${INK}" stroke-width="1.4"/>
       <path d="M38.6 38.6 L41.2 38.6" stroke="#FFFFFF" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>
       <path d="M54.1 38.6 L56.7 38.6" stroke="#FFFFFF" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>
       <path d="M46 47.6 Q51 50.2 55 46.4" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
  },
  {
    id: 'party', name: 'Party', tile: '#5E4CCB',
    art: () =>
      heartMark({ heart: '#FF4D6D' }) + eyes(INK) + grin(INK, '#FFC2CF') + cheeks('#FFB3C2') +
      `<g transform="rotate(-14 62 22)">
         <path d="M55 27 L62 8 L69 27 Z" fill="#FFE7A0" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
         <path d="M57.3 21 L66.7 21" stroke="#FF4D6D" stroke-width="1.6"/><path d="M59.4 15 L64.6 15" stroke="#5BC0EB" stroke-width="1.5"/>
         <circle cx="62" cy="7.6" r="2.2" fill="#FF4D6D" stroke="${INK}" stroke-width="0.8"/>
       </g>
       <rect x="20" y="16" width="2.6" height="2.6" rx="0.5" fill="#FFE7A0" transform="rotate(20 21 17)"/>
       <circle cx="29" cy="11" r="1.4" fill="#5BC0EB"/><rect x="80" y="30" width="2.6" height="2.6" rx="0.5" fill="#FFFFFF" transform="rotate(-25 81 31)"/>
       <circle cx="16" cy="32" r="1.3" fill="#FFFFFF"/><circle cx="84" cy="20" r="1.4" fill="#FFE7A0"/>`,
  },
  {
    id: 'shy', name: 'Shy', tile: '#F1A3B6',
    art: () =>
      heartMark({ heart: '#9E1240' }) +
      `<ellipse cx="43.4" cy="41.6" rx="2.2" ry="2.6" fill="#FFFFFF"/><ellipse cx="56.6" cy="41.6" rx="2.2" ry="2.6" fill="#FFFFFF"/>
       <path d="M47.6 47.2 Q50 48.8 52.4 47.2" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
       <ellipse cx="37.4" cy="45.6" rx="3.6" ry="2.1" fill="#FF8FA3"/><ellipse cx="62.6" cy="45.6" rx="3.6" ry="2.1" fill="#FF8FA3"/>
       <path d="M35 44.6 l1.4 1.4 M37.4 44.2 l1.4 1.4 M60.2 44.2 l1.4 1.4 M62.6 44.6 l1.4 1.4" stroke="#9E1240" stroke-width="0.6" stroke-linecap="round"/>`,
  },
  {
    id: 'kiss', name: 'Kiss', tile: '#FFCDB1',
    art: () =>
      heartMark({ heart: '#FF4D6D' }) + closedEye(43, INK, true) + closedEye(57, INK, true) +
      `<path d="M50.6 44.6 Q53 46.2 50.8 47.4 Q53.2 48.6 50.6 50.2" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>` +
      cheeks('#FFB3C2') + miniHeart(68, 20, 0.2, '#FF4D6D') + miniHeart(77, 12, 0.12, '#FF4D6D'),
  },
  {
    id: 'starstruck', name: 'Starstruck', tile: '#FFE7A0',
    art: () =>
      heartMark({ heart: '#FF4D6D' }) + star(43, 40, 4.2, '#FFE7A0', INK) + star(57, 40, 4.2, '#FFE7A0', INK) +
      grin(INK) + star(20, 18, 3, '#FF4D6D', 'none') + star(81, 24, 2.2, '#FF4D6D', 'none'),
  },
  {
    id: 'missing-you', name: 'Missing you', tile: '#B8D9FF',
    art: () =>
      heartMark({ heart: '#1D5BD8' }) +
      `<path d="M39.4 37.4 L45 35.4 M60.6 37.4 L55 35.4" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round"/>` +
      eyes('#FFFFFF', '#1D5BD8', 41) +
      `<path d="M46 48.4 Q50 45.8 54 48.4" fill="none" stroke="#FFFFFF" stroke-width="1.7" stroke-linecap="round"/>
       <path d="M58.4 44.6 Q60.2 47.6 58.4 49 Q56.6 47.6 58.4 44.6 Z" fill="#B8D9FF"/>`,
  },
  {
    id: 'pixel', name: 'Pixel', tile: '#1A1A1A',
    art: () => {
      // An 11 x 9 pixel heart, flat at the bottom like the mark, over pixel lines.
      const rows = ['01110001110', '11111011111', '11111111111', '11111111111', '11111111111', '01111111110', '00111111100'];
      const px = 4.6;
      const ox = 50 - (11 * px) / 2;
      const oy = 22;
      let out = '';
      rows.forEach((r, y) => [...r].forEach((c, x) => {
        if (c === '1') out += `<rect x="${(ox + x * px).toFixed(2)}" y="${(oy + y * px).toFixed(2)}" width="${px}" height="${px}" fill="#FF4D6D"/>`;
      }));
      out += `<rect x="${ox + px}" y="${oy + px}" width="${px}" height="${px}" fill="#FFB3C2"/>`;
      const bar = (y, from, to) => `<rect x="${(ox + from * px).toFixed(2)}" y="${y}" width="${((to - from) * px).toFixed(2)}" height="${px * 0.8}" fill="#FF4D6D"/>`;
      return out + bar(59, 2, 9) + bar(65.4, 3.5, 7.5) + `<rect x="${50 - px * 0.4}" y="71.2" width="${px * 0.8}" height="${px * 0.8}" fill="#FF4D6D"/>`;
    },
  },
  {
    id: 'neon', name: 'Neon', tile: '#0B0A14',
    art: () =>
      `<defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
       <g filter="url(#glow)">${heartMark({ heart: 'none', lines: '#FF4D6D', heartStyle: 'fill="none" stroke="#FF4D6D" stroke-width="2.4" stroke-linejoin="round"' })}
       <path d="M27.9 54.9 H72.1" stroke="#FF4D6D" stroke-width="2.4" stroke-linecap="round"/></g>`,
  },
  {
    id: 'duo', name: 'Duo', tile: '#DCD1FF',
    art: () => {
      const small = (cx, fill, tilt) =>
        `<g transform="rotate(${tilt} ${cx} 44)"><g transform="translate(${cx - 50} 0)"><g transform="translate(50 46) scale(0.62) translate(-50 -50)"><path d="${HEART}" fill="${fill}"/></g></g></g>`;
      const face = (cx, ink) =>
        `<ellipse cx="${cx - 4}" cy="41" rx="1.6" ry="2.1" fill="${ink}"/><ellipse cx="${cx + 4}" cy="41" rx="1.6" ry="2.1" fill="${ink}"/>
         <path d="M${cx - 2.6} 45 Q${cx} 47.4 ${cx + 2.6} 45" fill="none" stroke="${ink}" stroke-width="1.3" stroke-linecap="round"/>`;
      return `<g transform="translate(0 -6.59)">
          <path d="M32.68 66.35 H67.32" stroke="#5E4CCB" stroke-width="3.4" stroke-linecap="round"/>
          <path d="M39.66 72.91 H60.34" stroke="#5E4CCB" stroke-width="3.4" stroke-linecap="round"/>
          <circle cx="50" cy="79.86" r="2.1" fill="#5E4CCB"/></g>
        ${small(38, '#FF4D6D', -10)}${small(62, '#5E4CCB', 10)}${face(38, INK)}${face(62, '#FFFFFF')}
        ${miniHeart(50, 24, 0.11, '#FF4D6D')}`;
    },
  },
];

const svgFor = (v) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100" style="display:block"><rect width="100" height="100" fill="${v.tile}"/>${v.art()}</svg>`;
// Android adaptive icon foreground: the art alone, shrunk into the 66% safe zone, on transparency.
const foregroundSvgFor = (v) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100" style="display:block"><g transform="translate(50 50) scale(0.6) translate(-50 -45)">${v.art()}</g></svg>`;

/** The name the app and the native build use (PascalCase); the original is the default icon. */
const nativeName = (v) => v.id.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');

function shot(html, out, w, h, transparent = false) {
  const path = join(tmpDir, 'page.html');
  writeFileSync(path, html);
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--default-background-color=${transparent ? '00000000' : 'FFFFFFFF'}`, `--window-size=${w},${h}`, `--screenshot=${out}`, pathToFileURL(path).href,
  ], { stdio: 'ignore' });
}

const appIconsDir = join(here, '..', '..', 'assets', 'app-icons');
rmSync(outDir, { recursive: true, force: true });
rmSync(appIconsDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(appIconsDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });
for (const v of VARIANTS) {
  writeFileSync(join(outDir, `${v.id}.svg`), svgFor(v));
  shot(`<!doctype html><html><body style="margin:0;width:1024px;height:1024px;overflow:hidden">${svgFor(v)}</body></html>`, join(outDir, `${v.id}-1024.png`), 1024, 1024);
  // The app's own copies (the original is the default icon already).
  if (v.id !== 'original') {
    const name = nativeName(v);
    shot(`<!doctype html><html><body style="margin:0;width:1024px;height:1024px;overflow:hidden">${svgFor(v)}</body></html>`, join(appIconsDir, `${name}.png`), 1024, 1024);
    shot(`<!doctype html><html><body style="margin:0;width:1024px;height:1024px;overflow:hidden;background:transparent">${foregroundSvgFor(v)}</body></html>`, join(appIconsDir, `${name}-android.png`), 1024, 1024, true);
  }
  console.log(`icon  ${v.id}`);
}
// The plugin entry for app.json, and the list the Settings picker uses.
writeFileSync(
  join(appIconsDir, 'icons.json'),
  JSON.stringify(
    VARIANTS.filter((v) => v.id !== 'original').map((v) => ({
      name: nativeName(v),
      ios: `./assets/app-icons/${nativeName(v)}.png`,
      android: { foregroundImage: `./assets/app-icons/${nativeName(v)}-android.png`, backgroundColor: v.tile },
    })),
    null,
    2,
  ),
);

// Preview: each icon with iOS's rounded corners, on a dark Home Screen-like ground.
const cell = (v) => `<div style="display:flex;flex-direction:column;align-items:center;gap:16px">
  <img src="${pathToFileURL(join(outDir, `${v.id}-1024.png`)).href}" style="width:200px;height:200px;border-radius:45px;box-shadow:0 10px 30px rgba(0,0,0,0.35)">
  <span style="font:600 28px Inter,system-ui,sans-serif;color:#FFFFFF">${v.name}</span></div>`;
const rows = Math.ceil(VARIANTS.length / 5);
shot(`<!doctype html><html><body style="margin:0;background:#3A3560">
  <div style="width:1500px;padding:70px;box-sizing:border-box;display:grid;grid-template-columns:repeat(5,1fr);gap:60px 30px">${VARIANTS.map(cell).join('')}</div>
</body></html>`, join(outDir, '_all-icons-preview.png'), 1500, 140 + rows * 330);
console.log('sheet _all-icons-preview.png');
rmSync(tmpDir, { recursive: true, force: true });
