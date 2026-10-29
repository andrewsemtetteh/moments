// Exports the app's sticker art (the streak page's flame and heart) as transparent PNGs for the
// iOS widgets, which can't draw the React components. Same paths and colours as
// src/components/home/StickerFlame.tsx and StickerHeart.tsx.
// Run: node scripts/widget-stickers.mjs  → targets/widget/stickers/*.png
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repo, 'targets', 'widget', 'stickers');
const tmp = join(repo, 'scripts', '.tmp-stickers');

const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));
if (!chrome) throw new Error('No Chrome or Edge found for rendering');

const FLAME_OUTER = 'M60 4 C66 26 90 40 99 66 C108 96 92 134 60 135 C28 134 11 104 19 76 C23 61 31 52 38 46 C37 60 42 70 50 73 C45 50 49 27 60 4 Z';
const FLAME_INNER = 'M62 56 C70 70 84 81 84 101 C84 118 74 128 60 128 C46 128 36 118 36 104 C36 92 42 84 50 78 C50 88 54 94 60 96 C56 82 56 69 62 56 Z';
const PALETTES = {
  lit: { outer: ['#FFB23E', '#FF7A1A', '#F0501A'], inner: ['#FFF0A8', '#FFC83D'], shine: '#FFD49A' },
  out: { outer: ['#D3CFCA', '#B9B4AF', '#9C978F'], inner: ['#F0EDE9', '#DCD8D3'], shine: '#E6E2DD' },
};
const FACE = `<path d="M53.5 111 Q60 117 66.5 111" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="45.5" cy="110" rx="3.8" ry="2.3" fill="#FF8FA3"/><ellipse cx="74.5" cy="110" rx="3.8" ry="2.3" fill="#FF8FA3"/>
  <ellipse cx="52.5" cy="101" rx="3.6" ry="4.6" fill="#000"/><ellipse cx="67.5" cy="101" rx="3.6" ry="4.6" fill="#000"/>
  <circle cx="53.8" cy="99.2" r="1.25" fill="#fff"/><circle cx="68.8" cy="99.2" r="1.25" fill="#fff"/>`;

function flame(variant, face) {
  const p = PALETTES[variant];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="420" viewBox="-4 -2 128 142">
    <defs>
      <linearGradient id="o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.outer[0]}"/><stop offset="0.45" stop-color="${p.outer[1]}"/><stop offset="1" stop-color="${p.outer[2]}"/></linearGradient>
      <linearGradient id="i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.inner[0]}"/><stop offset="1" stop-color="${p.inner[1]}"/></linearGradient>
    </defs>
    <path d="${FLAME_OUTER}" fill="url(#o)" stroke="#000" stroke-width="5" stroke-linejoin="round"/>
    <path d="M28.5 108 C25 98 25.5 88 29.5 80" fill="none" stroke="${p.shine}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="${FLAME_INNER}" fill="url(#i)" stroke="#000" stroke-width="4.5" stroke-linejoin="round"/>
    ${face ? FACE : ''}
  </svg>`;
}

function heart() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="396" height="348" viewBox="-6 -4 132 116">
    <defs><linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFA3BC"/><stop offset="0.5" stop-color="#FF5C8A"/><stop offset="1" stop-color="#E8336A"/></linearGradient></defs>
    <path d="M60 102 C54 97 16 72 9 46 C3 24 18 6 38 6 C49 6 56 12 60 21 C64 12 71 6 82 6 C102 6 117 24 111 46 C104 72 66 97 60 102 Z" fill="url(#h)" stroke="#000" stroke-width="5.5" stroke-linejoin="round"/>
    <path d="M24 40 C23 30 29 22 38 21" fill="none" stroke="#FFD3DF" stroke-width="7" stroke-linecap="round"/>
  </svg>`;
}

const STICKERS = {
  'sticker-flame': [flame('lit', true), 360, 420],
  'sticker-flame-out': [flame('out', false), 360, 420],
  'sticker-heart': [heart(), 396, 348],
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(tmp, { recursive: true });
for (const [name, [svg, w, h]] of Object.entries(STICKERS)) {
  const page = join(tmp, `${name}.html`);
  writeFileSync(page, `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', `--window-size=${w},${h}`, `--screenshot=${join(outDir, `${name}.png`)}`,
    pathToFileURL(page).href,
  ], { stdio: 'ignore' });
  console.log(`sticker  ${name}.png`);
}
rmSync(tmp, { recursive: true, force: true });
