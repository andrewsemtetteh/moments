// Renders a slideshow post (marketing/carousels/slideshow/<year>/<MM - month>/<n> - <day>/post.json) into PNG slides.
//   slideshow/<n>/slides/01.png …  1080×1350 (4:5) — one size for Instagram and TikTok
//   slideshow/<n>/preview.png      contact sheet of every slide
// Usage: node marketing/carousels/_tools/render.mjs 1 [2 3 ...]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ILLUSTRATIONS, POLAROID_ART } from './illustrations.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const slideshowDir = resolve(here, '../slideshow');
const repoRoot = resolve(here, '../../..');
const url = (p) => pathToFileURL(p).href;
const brandFonts = url(join(repoRoot, 'assets/fonts'));
const uiFonts = url(join(here, 'fonts'));
const logoDir = join(repoRoot, 'assets/branding/moments-e8/logo');
// Official lockups (mark + "Moments" wordmark): white text for dark surfaces, dark text for light.
// Inlined so a theme can recolor the coral heart (`logoMark`) where coral would be hard to see.
const LOCKUP = {
  dark: readFileSync(join(logoDir, 'lockup-dark.svg'), 'utf8'),
  light: readFileSync(join(logoDir, 'lockup-light.svg'), 'utf8'),
};
const lockup = (t) => LOCKUP[t.lockup].replace(/#FF4D6D/gi, t.logoMark ?? '#FF4D6D');

const CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
];
const chrome = CHROME_PATHS.find((p) => existsSync(p));
if (!chrome) throw new Error('No Chrome/Edge found for rendering');

const W = 1080;
const H = 1350;

// Themes come from the app's own brand themes (src/constants/design-system.ts). Each post picks one
// with "theme", a card design with "cardStyle" and a cover scene with "illustration". Fixed across all
// posts: fonts, 4:5 size, centered cover/save, bookmark + lockup on the save slide, no emoji.
const THEMES = {
  night: {
    bg: '#1F1B3A', onBg: '#FFFFFF', onBgMuted: 'rgba(255,255,255,0.55)', accentOnBg: '#FF4D6D',
    card: '#FFFFFF', onCard: '#1F1B3A', onCardMuted: 'rgba(31,27,58,0.4)', accentOnCard: '#E8395B',
    back1: '#3D3870', back2: '#2D2952', illo: '#FF4D6D', lockup: 'dark',
  },
  blue: {
    bg: '#1D5BD8', onBg: '#FFFFFF', onBgMuted: 'rgba(255,255,255,0.72)', accentOnBg: '#FFD93D',
    card: '#FFFFFF', onCard: '#0F1E4A', onCardMuted: 'rgba(15,30,74,0.45)', accentOnCard: '#1D5BD8',
    back1: '#3B74E6', back2: '#1749B5', illo: '#FF4D6D', lockup: 'dark', logoMark: '#FFD93D',
  },
  coral: {
    bg: '#EE633C', onBg: '#FFFFFF', onBgMuted: 'rgba(255,255,255,0.78)', accentOnBg: '#FFE7A0',
    card: '#FFF8EE', onCard: '#2A1A14', onCardMuted: 'rgba(42,26,20,0.45)', accentOnCard: '#B8441E',
    back1: '#F58A68', back2: '#C94F2C', illo: '#FFE7A0', lockup: 'dark', logoMark: '#FFE7A0',
  },
  violet: {
    bg: '#7B69E8', onBg: '#FFFFFF', onBgMuted: 'rgba(255,255,255,0.75)', accentOnBg: '#FFE7A0',
    card: '#FFFFFF', onCard: '#1F1B3A', onCardMuted: 'rgba(31,27,58,0.45)', accentOnCard: '#5E4CCB',
    back1: '#9686F0', back2: '#5E4CCB', illo: '#FF4D6D', lockup: 'dark', logoMark: '#FFE7A0', tint: '#E3DDFF',
  },
  cream: {
    bg: '#FFF8EE', onBg: '#1A1A1A', onBgMuted: 'rgba(26,26,26,0.55)', accentOnBg: '#E8395B',
    card: '#FFFFFF', onCard: '#1A1A1A', onCardMuted: 'rgba(26,26,26,0.45)', accentOnCard: '#E8395B',
    back1: '#FFD9CC', back2: '#FFE7A0', illo: '#FF4D6D', lockup: 'light',
  },
  blush: {
    bg: '#F1A3B6', onBg: '#1A1A1A', onBgMuted: 'rgba(26,26,26,0.62)', accentOnBg: '#9E1240',
    card: '#FFFFFF', onCard: '#1A1A1A', onCardMuted: 'rgba(26,26,26,0.45)', accentOnCard: '#E8395B',
    back1: '#FFD9CC', back2: '#FF9EC4', illo: '#FF4D6D', lockup: 'light', logoMark: '#9E1240',
  },
  // Candy-bright "color" app theme: electric blue page, sunny highlights, candy cards (palette).
  electric: {
    bg: '#2E5BFF', onBg: '#FFFFFF', onBgMuted: 'rgba(255,255,255,0.78)', accentOnBg: '#FFD93D',
    card: '#FFFFFF', onCard: '#0B0B0B', onCardMuted: 'rgba(0,0,0,0.5)', accentOnCard: '#2E5BFF',
    back1: '#5B7FFF', back2: '#1E44D6', illo: '#FF4D6D', lockup: 'dark', logoMark: '#FFD93D',
    palette: ['#FF9EC4', '#FFD93D', '#88E3B5', '#FFB38A', '#C3B1FF', '#8EC5FF'],
  },
  mint: {
    bg: '#B2EFD1', onBg: '#0B2E22', onBgMuted: 'rgba(11,46,34,0.62)', accentOnBg: '#0B6E4F',
    card: '#FFFFFF', onCard: '#0B2E22', onCardMuted: 'rgba(11,46,34,0.45)', accentOnCard: '#0B8A62',
    back1: '#88E3B5', back2: '#D7F2E3', illo: '#FF4D6D', lockup: 'light', logoMark: '#0B6E4F',
  },
  ink: {
    bg: '#0E0E0E', onBg: '#FFFFFF', onBgMuted: 'rgba(255,255,255,0.6)', accentOnBg: '#FFE7A0',
    card: '#1C1C1E', onCard: '#FFFFFF', onCardMuted: 'rgba(255,255,255,0.5)', accentOnCard: '#FFD60A',
    back1: '#2C2C2E', back2: '#3A3A3C', illo: '#FF4D6D', lockup: 'dark',
    palette: ['#FFF6E5', '#FF4D6D'],
  },
  lilac: {
    bg: '#DCD1FF', onBg: '#1F1B3A', onBgMuted: 'rgba(31,27,58,0.62)', accentOnBg: '#5E4CCB',
    card: '#FFFFFF', onCard: '#1F1B3A', onCardMuted: 'rgba(31,27,58,0.45)', accentOnCard: '#5E4CCB',
    back1: '#C3B1FF', back2: '#EDE7FF', illo: '#FF4D6D', lockup: 'light', logoMark: '#5E4CCB',
  },
  peach: {
    bg: '#FFCDB1', onBg: '#3A1C10', onBgMuted: 'rgba(58,28,16,0.62)', accentOnBg: '#B8441E',
    card: '#FFFFFF', onCard: '#3A1C10', onCardMuted: 'rgba(58,28,16,0.45)', accentOnCard: '#B8441E',
    back1: '#FFB38A', back2: '#FFE3D3', illo: '#FF4D6D', lockup: 'light', logoMark: '#B8441E',
  },
  sky: {
    bg: '#B8D9FF', onBg: '#0F1E4A', onBgMuted: 'rgba(15,30,74,0.62)', accentOnBg: '#1D5BD8',
    card: '#FFFFFF', onCard: '#0F1E4A', onCardMuted: 'rgba(15,30,74,0.45)', accentOnCard: '#1D5BD8',
    back1: '#8EC5FF', back2: '#DCEBFF', illo: '#FF4D6D', lockup: 'light', logoMark: '#1D5BD8',
  },
  sunny: {
    bg: '#FFD93D', onBg: '#000000', onBgMuted: 'rgba(0,0,0,0.6)', accentOnBg: '#2E5BFF',
    card: '#FFFFFF', onCard: '#000000', onCardMuted: 'rgba(0,0,0,0.45)', accentOnCard: '#2E5BFF',
    back1: '#FF9EC4', back2: '#8EC5FF', illo: '#2E5BFF', lockup: 'light', logoMark: '#2E5BFF',
    palette: ['#FFFFFF', '#FF9EC4', '#8EC5FF', '#88E3B5', '#FFB38A'],
  },
};

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// *phrase* → italic accent emphasis; straight apostrophes → typographic ones
const rich = (s = '') => esc(s).replace(/'/g, '’').replace(/\*(.+?)\*/g, '<em>$1</em>');
const pad = (n) => String(n).padStart(2, '0');

const ICONS = {
  bookmark: `<svg width="84" height="105" viewBox="0 0 24 30" fill="none"><path d="M3 2.5h18v25l-9-6.5-9 6.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  plane: `<svg width="56" height="56" viewBox="-32 -32 64 64" fill="currentColor"><g transform="rotate(0)"><path d="M-28 0l48-5c8 0 12 2 12 5s-4 5-12 5z"/><path d="M-2-2l-12-24h9l17 22zM-2 2l-12 24h9l17-22z"/><path d="M-22-1l-7-12h6l8 11zM-22 1l-7 12h6l8-11z"/></g></svg>`,
  check: `<svg width="92" height="80" viewBox="0 0 92 80" fill="none"><path d="M10 44l20 20L84 8" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  tick: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  flame: `<svg width="30" height="36" viewBox="0 0 20 24"><path d="M10 1c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4 0-6 1-9z" fill="currentColor"/></svg>`,
  heart: `<svg width="34" height="34" viewBox="-7 -6 14 13"><path d="M0 6.2C-3.8 3.6-6 1.4-6-1.1-6-2.9-4.6-4.3-2.9-4.3-1.7-4.3-.6-3.6 0-2.6.6-3.6 1.7-4.3 2.9-4.3 4.6-4.3 6-2.9 6-1.1 6 1.4 3.8 3.6 0 6.2Z" fill="#FFFFFF"/></svg>`,
  send: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bubble: `<svg width="56" height="52" viewBox="0 0 28 26" fill="none"><path d="M4 3h20a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H12l-6 5v-5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="currentColor"/></svg>`,
  bolt: `<svg width="44" height="58" viewBox="0 0 22 29"><path d="M13 1L2 17h8l-2 11 12-17h-8z" fill="currentColor"/></svg>`,
  scissors: `<svg width="46" height="46" viewBox="0 0 24 24" fill="none"><circle cx="6" cy="6" r="3" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="2"/><path d="M8.5 7.5L20 18M8.5 16.5L20 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  arrow: `<svg width="64" height="20" viewBox="0 0 64 20" fill="none"><path d="M0 10h60M52 2l8 8-8 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

// Content slides (questions, tips): a white card on a fanned stack, count + progress in the footer.
function cardStack(slide, total, inner) {
  return `
    <div class="stack">
      <div class="back b2"></div>
      <div class="back b1"></div>
      <section class="card" style="transform: rotate(${slide.n % 2 ? -0.6 : 0.6}deg)">
        ${inner}
        <div class="card-foot">
          <span class="count">${pad(slide.n)} / ${pad(total)}</span>
          <span class="bar"><b style="width:${(slide.n / total) * 100}%"></b></span>
        </div>
      </section>
    </div>`;
}

// Long-distance card: each tip is a boarding pass from "me" to "you", with a perforated stub.
function ticket(slide, total, inner) {
  return `
    <div class="ticket-wrap" style="transform: rotate(${slide.n % 2 ? -1.2 : 1.2}deg)"><div class="ticket">
      <div class="t-top">
        <div class="t-row"><span>Boarding pass</span><span>Tip ${pad(slide.n)} of ${pad(total)}</span></div>
        <div class="t-route">
          <div><b>ME</b><small>Here</small></div>
          <div class="t-path"><i></i>${ICONS.plane}<i></i></div>
          <div class="right"><b>YOU</b><small>There</small></div>
        </div>
      </div>
      <div class="t-perf"></div>
      <div class="t-body">${inner}</div>
      <div class="t-foot"><span class="barcode"></span><span class="seat"><small>Seat</small>Next to you</span></div>
    </div></div>`;
}

// Acts of service: each tip is a taped sticky note — a ticked to-do, signed "love, me".
function sticky(slide, total, inner) {
  return `
    <div class="sticky-wrap">
      <div class="note under"></div>
      <div class="note-holder" style="transform: rotate(${slide.n % 2 ? -1.6 : 1.4}deg)">
      <div class="note">
        <div class="note-head"><span>To do</span><span>${pad(slide.n)} / ${pad(total)}</span></div>
        <div class="todo">
          <span class="box">${ICONS.check}</span>
          ${inner}
        </div>
        <div class="note-foot"><span class="hand">love, me</span></div>
      </div>
      <span class="tape"></span>
      </div>
    </div>`;
}

// This or That: one card split into option A (top) and option B (bottom) with an "or" badge on the seam.
function versus(slide, total) {
  return `
    <div class="vs-wrap">
      <div class="vs-back"></div>
      <div class="vs" style="transform: rotate(${slide.n % 2 ? -1 : 1}deg)">
        <div class="vs-half a">
          <div class="vs-meta">Round ${pad(slide.n)} / ${pad(total)}</div>
          <span class="vs-key">A</span><h2>${rich(slide.a)}</h2>
        </div>
        <div class="vs-half b"><span class="vs-key">B</span><h2>${rich(slide.b)}</h2></div>
        <div class="vs-or">or</div>
      </div>
    </div>`;
}

// Date ideas: each idea is a polaroid — a small illustrated "photo", a handwritten stamp and the idea
// written underneath — on top of two more polaroids.
function polaroid(slide, total) {
  const art = POLAROID_ART[slide.art];
  return `
    <div class="pol-wrap">
      <div class="pol back p2"></div>
      <div class="pol back p1"></div>
      <div class="pol" style="transform: rotate(${slide.n % 2 ? -2 : 1.8}deg)">
        <div class="pol-photo" style="background: ${slide.tint}">${art ? art() : ''}
          <span class="pol-stamp">date no. ${slide.n}</span>
        </div>
        <div class="pol-caption">
          <h2>${rich(slide.title)}</h2>
          <p>${rich(slide.body)}</p>
        </div>
        <div class="pol-count">${pad(slide.n)} / ${pad(total)}</div>
      </div>
    </div>`;
}

// Habits: each tip is a habit-tracker card — the habit, then a week of days with a streak count.
function tracker(slide, total, inner) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const done = slide.week ?? '1111110';
  const streak = done.length - done.replace(/^1+/, '').length;
  return `
    <div class="tr-wrap">
      <div class="tr-back"></div>
      <div class="tr" style="transform: rotate(${slide.n % 2 ? -1.2 : 1.2}deg)">
        <div class="tr-head"><span>Daily habit</span><span>${pad(slide.n)} / ${pad(total)}</span></div>
        <div class="tr-body">${inner}</div>
        <div class="tr-week">
          ${days.map((d, i) => `<div class="tr-day ${done[i] === '1' ? 'on' : ''}"><i>${done[i] === '1' ? ICONS.tick : ''}</i><span>${d}</span></div>`).join('')}
        </div>
        <div class="tr-foot">${ICONS.flame}<span>${streak}-day streak</span></div>
      </div>
    </div>`;
}

// Lazy dates: each idea is a printed receipt — order number, the idea, effort/cost/time lines,
// a sign-off and a barcode, with a torn zigzag bottom edge.
function receipt(slide, total, inner) {
  const dots = (n) => [1, 2, 3].map((i) => `<b class="${i <= n ? 'on' : ''}"></b>`).join('');
  return `
    <div class="rc-wrap" style="transform: rotate(${slide.n % 2 ? -1.4 : 1.4}deg)">
      <div class="rc">
        <div class="rc-head"><b>The lazy date</b><span>Order no. ${pad(slide.n)} of ${pad(total)}</span></div>
        <div class="rc-rule"></div>
        <div class="rc-body">${inner}</div>
        <div class="rc-rule"></div>
        <div class="rc-line"><span>Effort</span><i></i><span class="dots">${dots(slide.effort ?? 1)}</span></div>
        <div class="rc-line"><span>Cost</span><i></i><span>${esc(slide.cost ?? 'Free')}</span></div>
        <div class="rc-line"><span>Time</span><i></i><span>${esc(slide.time ?? '1 hr')}</span></div>
        <div class="rc-rule"></div>
        <div class="rc-thanks">Thank you for staying in</div>
        <div class="rc-barcode"></div>
      </div>
    </div>`;
}

// Deep questions: each question is a sent text on a chat screen, with the partner already typing back.
function chat(slide, total, inner) {
  return `
    <div class="ch-wrap" style="transform: rotate(${slide.n % 2 ? -1 : 1}deg)">
      <div class="ch">
        <div class="ch-head">
          <span class="ch-avatar">${ICONS.heart}</span>
          <div><b>My person</b><small>Question ${pad(slide.n)} of ${pad(total)}</small></div>
        </div>
        <div class="ch-body">
          <div class="ch-time">Tonight, ${esc(slide.time ?? '10:42 PM')}</div>
          <div class="ch-sent">${inner}</div>
          <div class="ch-read">Read</div>
          <div class="ch-typing"><i></i><i></i><i></i></div>
        </div>
        <div class="ch-input"><span>Type your answer…</span><b>${ICONS.send}</b></div>
      </div>
    </div>`;
}

// A postage stamp: white paper with perforation notches cut along every edge, coral face with a heart.
function stamp(w = 124, h = 150, r = 5.5, step = 15) {
  const holes = [];
  for (let x = step / 2; x < w; x += step) holes.push([x, 0], [x, h]);
  for (let y = step / 2; y < h; y += step) holes.push([0, y], [w, y]);
  return `
    <svg class="pc-stamp" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs><mask id="perf"><rect width="${w}" height="${h}" fill="#fff"/>
        ${holes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#000"/>`).join('')}
      </mask></defs>
      <rect width="${w}" height="${h}" fill="#FFFFFF" mask="url(#perf)"/>
      <rect x="14" y="14" width="${w - 28}" height="${h - 28}" fill="#FF4D6D"/>
      <path transform="translate(${w / 2} ${h / 2 - 2}) scale(4.2)" fill="#FFFFFF"
            d="M0 6.2C-3.8 3.6-6 1.4-6-1.1-6-2.9-4.6-4.3-2.9-4.3-1.7-4.3-.6-3.6 0-2.6.6-3.6 1.7-4.3 2.9-4.3 4.6-4.3 6-2.9 6-1.1 6 1.4 3.8 3.6 0 6.2Z"/>
    </svg>`;
}

// Long-distance dates: each idea is a postcard — message on the left; stamp, postmark and a
// handwritten address on the right — over a second postcard.
function postcard(slide, total, inner) {
  return `
    <div class="pc-wrap">
      <div class="pc back"></div>
      <div class="pc" style="transform: rotate(${slide.n % 2 ? -2 : 2}deg)">
        <div class="pc-msg">
          <div class="pc-meta">Date idea ${pad(slide.n)} / ${pad(total)}</div>
          ${inner}
        </div>
        <div class="pc-side">
          <div class="pc-stamp-row">
            <svg class="pc-postmark" width="150" height="110" viewBox="0 0 150 110" fill="none">
              <circle cx="56" cy="55" r="42" stroke="currentColor" stroke-width="3"/>
              <circle cx="56" cy="55" r="32" stroke="currentColor" stroke-width="2"/>
              <text x="56" y="51" text-anchor="middle" font-family="Inter" font-weight="600" font-size="12" letter-spacing="2" fill="currentColor">WITH</text>
              <text x="56" y="67" text-anchor="middle" font-family="Inter" font-weight="600" font-size="12" letter-spacing="2" fill="currentColor">LOVE</text>
              <path d="M100 36q10-8 20 0t20 0M100 55q10-8 20 0t20 0M100 74q10-8 20 0t20 0" stroke="currentColor" stroke-width="3"/>
            </svg>
            ${stamp()}
          </div>
          <div class="pc-addr">
            <div><small>To</small><span>my person</span></div>
            <div><small>From</small><span>miles away</span></div>
            <div><small></small><span></span></div>
          </div>
        </div>
      </div>
    </div>`;
}

// Best friends: each sign is a lined notebook page — punch holes, red margin, a handwritten
// "sign no." and a doodled heart — like a note passed in class.
function notebook(slide, total, inner) {
  return `
    <div class="nb-wrap">
      <div class="nb back"></div>
      <div class="nb" style="transform: rotate(${slide.n % 2 ? -1.5 : 1.5}deg)">
        <span class="nb-hole" style="top: 18%"></span><span class="nb-hole" style="top: 50%"></span><span class="nb-hole" style="top: 82%"></span>
        <div class="nb-head"><span class="hand">sign no. ${slide.n}</span><span>of ${pad(total)}</span></div>
        <div class="nb-body">${inner}</div>
        <svg class="nb-doodle" width="120" height="110" viewBox="0 0 120 110" fill="none">
          <path d="M60 96C26 72 10 54 12 34 14 16 32 8 46 14c8 4 12 10 14 18 2-8 8-16 18-18 16-4 30 8 28 26-2 20-20 38-46 58" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M40 40c-6 4-8 10-6 16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        </svg>
      </div>
    </div>`;
}

// Long lists: three candy-colored game cards per slide, each with a big number and the prompt.
function strips(slide, t) {
  const pal = t.palette ?? [t.card];
  return `
    <div class="st-wrap">
      ${slide.items.map((it, i) => `
        <div class="st" style="background: ${pal[(it.n - 1) % pal.length]}; transform: rotate(${[-1.4, 1.1, -0.8][i % 3]}deg)">
          <div class="st-num">${pad(it.n)}</div>
          <div class="st-text">
            ${(it.label ?? slide.label ?? 'Would you rather') ? `<div class="st-label">${esc(it.label ?? slide.label ?? 'Would you rather')}</div>` : ''}
            <h3>${rich(it.text)}</h3>
          </div>
        </div>`).join('')}
    </div>`;
}

// Truth or dare: a two-deck party game — one Truth card and one Dare card dealt per slide,
// with playing-card corner indices and an inner border.
function playingCard(kind, n, text, icon) {
  const key = kind === 'truth' ? 'T' : 'D';
  return `
    <div class="pl ${kind}">
      <div class="pl-idx tl"><b>${key}</b><span>${n}</span></div>
      <div class="pl-face">
        <div class="pl-icon">${icon}</div>
        <div class="pl-kind">${kind}</div>
        <h3>${rich(text)}</h3>
      </div>
      <div class="pl-idx br"><b>${key}</b><span>${n}</span></div>
    </div>`;
}

function dealPair(slide) {
  return `
    <div class="pl-table">
      <div class="pl-slot l">${playingCard('truth', slide.n, slide.truth, ICONS.bubble)}</div>
      <div class="pl-slot r">${playingCard('dare', slide.n, slide.dare, ICONS.bolt)}</div>
    </div>`;
}

// Conversation menu: each slide is one "course" of a fine-dining menu — five questions with
// numerals and dotted dividers, framed by a double rule.
function menu(slide) {
  return `
    <div class="mn-wrap">
      <div class="mn">
        <div class="mn-top">Tonight’s conversation</div>
        <div class="mn-course">Course ${pad(slide.course)} <span>of ${pad(slide.courses ?? 6)}</span></div>
        <h3 class="mn-title">${rich(slide.title)}</h3>
        ${slide.sub ? `<div class="mn-sub">${esc(slide.sub)}</div>` : ''}
        <div class="mn-rule"></div>
        <ol class="mn-items">
          ${slide.items.map((it) => `<li><b>${it.n}</b><span>${rich(it.text)}</span></li>`).join('')}
        </ol>
        <div class="mn-foot">Served with: no phones</div>
      </div>
    </div>`;
}

// Free dates: two love coupons per slide — dashed cut line with scissors, a FREE stub,
// "Good for one…" and "Expires: never".
function coupons(slide) {
  return `
    <div class="cp-wrap">
      ${slide.items.map((it, i) => `
        <div class="cp-cut" style="transform: rotate(${i % 2 ? 1.6 : -1.6}deg)">
          <span class="cp-scissors">${ICONS.scissors}</span>
          <div class="cp">
            <div class="cp-stub"><b>Free</b><span>No. ${pad(it.n)}</span></div>
            <div class="cp-main">
              <div class="cp-label">Good for one</div>
              <h3>${rich(it.title)}</h3>
              <p>${rich(it.body)}</p>
              <div class="cp-foot"><span>Expires: never</span><span>Cost: nothing</span></div>
            </div>
          </div>
        </div>`).join('')}
    </div>`;
}

// After an argument: calm "reset" cards — a soft breathing orb with the step number, the step
// name, the question and a gentle how-to-ask tip. Lots of air, nothing loud.
function calm(slide, total) {
  return `
    <div class="cm-wrap">
      <div class="cm">
        <div class="cm-orb"><span>${slide.n}</span></div>
        <div class="cm-step">Step ${slide.n} of ${total} · ${esc(slide.step ?? '')}</div>
        <h2>${rich(slide.text)}</h2>
        ${slide.tip ? `<p class="cm-tip">${rich(slide.tip)}</p>` : ''}
        <div class="cm-dots">${Array.from({ length: total }, (_, i) => `<i class="${i < slide.n ? 'on' : ''}"></i>`).join('')}</div>
      </div>
    </div>`;
}

// Long-distance truths: two luggage tags per slide — notched end, punched hole with a string,
// a "handle with care" band.
function luggage(slide) {
  return `
    <div class="lt-wrap">
      ${slide.items.map((it, i) => `
        <div class="lt-item" style="transform: rotate(${i % 2 ? 2.4 : -2.4}deg)">
          <div class="lt">
            <span class="lt-hole"></span>
            <div class="lt-band">Long distance · handle with care</div>
            <div class="lt-body">
              <div class="lt-label">Truth no. ${pad(it.n)}</div>
              <h3>${rich(it.title)}</h3>
              <p>${rich(it.body)}</p>
            </div>
          </div>
          <svg class="lt-string" width="200" height="300" viewBox="0 0 200 300" fill="none">
            <path d="M196 296C150 300 70 290 46 220S60 60 6 4" stroke="${t.onBgMuted}" stroke-width="5" stroke-linecap="round"/>
          </svg>
        </div>`).join('')}
    </div>`;
}

// Attachment styles: a color-tabbed file folder per style — icon, name, "in an argument" and "what helps".
const STYLE_ICONS = {
  secure: '<svg width="120" height="80" viewBox="0 0 120 80" fill="none"><circle cx="44" cy="40" r="30" stroke="currentColor" stroke-width="7"/><circle cx="76" cy="40" r="30" stroke="currentColor" stroke-width="7"/></svg>',
  anxious: '<svg width="120" height="80" viewBox="0 0 120 80" fill="none"><path d="M6 44h22l10-26 14 48 14-56 12 44 10-10h26" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  avoidant: '<svg width="120" height="80" viewBox="0 0 120 80" fill="none"><rect x="30" y="6" width="56" height="70" rx="6" stroke="currentColor" stroke-width="7"/><path d="M58 10l26 8v56l-26 4z" fill="currentColor" opacity=".35"/><circle cx="68" cy="44" r="4" fill="currentColor"/></svg>',
  fearful: '<svg width="120" height="80" viewBox="0 0 120 80" fill="none"><path d="M54 26H10m0 0l14-14M10 26l14 14M66 54h44m0 0L96 40m14 14L96 68" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function folder(slide, total) {
  return `
    <div class="fd-wrap">
      <div class="fd-back" style="--tab: ${slide.nextTab ?? '#FFFFFF'}"><span></span></div>
      <div class="fd" style="--tab: ${slide.tab}">
        <div class="fd-tab">${esc(slide.name)}</div>
        <div class="fd-body">
          <div class="fd-top"><span class="fd-icon">${STYLE_ICONS[slide.icon] ?? ''}</span><span class="fd-count">${pad(slide.n)} / ${pad(total)}</span></div>
          <div class="fd-kicker">Attachment style</div>
          <h2>${rich(slide.title)}</h2>
          <div class="fd-sec"><b>In an argument</b><p>${rich(slide.fight)}</p></div>
          <div class="fd-sec"><b>What helps</b><p>${rich(slide.helps)}</p></div>
        </div>
      </div>
    </div>`;
}

// Grade your relationship: a school report card — subject, prompt, A–D boxes, teacher's note.
function report(slide, total) {
  return `
    <div class="rp-wrap" style="transform: rotate(${slide.n % 2 ? -1 : 1}deg)">
      <div class="rp">
        <div class="rp-head"><b>Relationship report card</b><span>Subject ${slide.n} of ${total}</span></div>
        <div class="rp-meta"><span>Students: <i>you two</i></span><span>Term: <i>this year</i></span></div>
        <h2>${rich(slide.subject)}</h2>
        <p class="rp-prompt">${rich(slide.prompt)}</p>
        <div class="rp-grades">${['A', 'B', 'C', 'D'].map((g) => `<span>${g}</span>`).join('')}</div>
        <div class="rp-note"><small>Teacher’s note</small><span>${esc(slide.note)}</span></div>
      </div>
    </div>`;
}

// Weeknight dates: a tear-off desk calendar page per weekday — rings, big day name, the idea.
function calendarPage(slide) {
  return `
    <div class="cl-wrap">
      <div class="cl-page back2"></div>
      <div class="cl-page back1"></div>
      <div class="cl-page">
        <div class="cl-bind"><i></i><i></i></div>
        <div class="cl-band">Weeknight date · under an hour</div>
        <div class="cl-day">${esc(slide.day)}</div>
        <h3>${rich(slide.title)}</h3>
        <p>${rich(slide.body)}</p>
        <div class="cl-tear"><span>tear here</span></div>
      </div>
    </div>`;
}

// Never admit it: a "confidential" case file — paperclip, red rubber stamp, a redacted witness line.
function caseFile(slide, total) {
  return `
    <div class="cf-wrap" style="transform: rotate(${slide.n % 2 ? -1.2 : 1.2}deg)">
      <div class="cf">
        <svg class="cf-clip" width="70" height="150" viewBox="0 0 70 150" fill="none">
          <path d="M20 120V30a15 15 0 0 1 30 0v86a9 9 0 0 1-18 0V40" stroke="#9AA0AE" stroke-width="7" stroke-linecap="round"/>
        </svg>
        <div class="cf-head"><span>Case file no. ${pad(slide.n)}</span><span>${pad(slide.n)} / ${pad(total)}</span></div>
        <div class="cf-sub">Subject: you, probably</div>
        <div class="cf-stamp">Confidential</div>
        <h2>${rich(slide.title)}</h2>
        <p>${rich(slide.body)}</p>
        <div class="cf-foot"><span>Witness: <b class="redact"></b></span><span class="cf-verdict">guilty</span></div>
      </div>
    </div>`;
}

// Finish the sentence: an index card with a real blank to fill in (___ in the text), and a pencil.
function blankCard(slide, total) {
  const text = rich(slide.text).replace(/_{3,}/g, '<span class="bl-line"></span>');
  return `
    <div class="bl-wrap" style="transform: rotate(${slide.n % 2 ? -1.5 : 1.5}deg)">
      <div class="bl">
        <div class="bl-head"><span>Finish the sentence</span><span>${pad(slide.n)} / ${pad(total)}</span></div>
        <h2>${text}</h2>
        <svg class="bl-pencil" width="300" height="60" viewBox="0 0 300 60" fill="none">
          <path d="M40 18h210l30 12-30 12H40z" fill="#FFD93D"/><path d="M40 18h210v8H40z" fill="#F2C200"/>
          <path d="M250 18l30 12-30 12z" fill="#F6CDAE"/><path d="M270 26l10 4-10 4z" fill="#1A1A1A"/>
          <rect x="14" y="18" width="30" height="24" rx="4" fill="#FF9EC4"/><rect x="40" y="18" width="10" height="24" fill="#C9C9D6"/>
        </svg>
      </div>
    </div>`;
}

// Green flags: a white card with a waving green flag on a pole carrying the number, text below.
function flagCard(slide, total) {
  return `
    <div class="gf-wrap">
      <div class="gf">
        <svg class="gf-flag" width="260" height="230" viewBox="0 0 260 230" fill="none">
          <rect x="30" y="10" width="12" height="216" rx="6" fill="#3A3A3A"/>
          <circle cx="36" cy="12" r="11" fill="#FFD93D"/>
          <path d="M42 28c50-22 90 22 140 0s52-6 70 4v100c-18-10-30-24-70-4s-90-22-140 0z" fill="#22B36B"/>
          <path d="M42 28c50-22 90 22 140 0s52-6 70 4v18c-18-10-30-24-70-4s-90-22-140 0z" fill="#1E9E5E"/>
          <text x="148" y="104" text-anchor="middle" font-family="Serif" font-size="62" fill="#FFFFFF">${slide.n}</text>
        </svg>
        <div class="gf-label">Green flag ${pad(slide.n)} / ${pad(total)}</div>
        <h2>${rich(slide.title)}</h2>
        <p>${rich(slide.body)}</p>
      </div>
    </div>`;
}

// Love jar: three folded paper notes per slide, unfolded — torn edges, a fold crease, a heart doodle.
const NOTE_PAPERS = ['#FFF6E5', '#FFE1E8', '#FFF1B8', '#E6F4FF', '#EAF7EE'];
function loveNotes(slide) {
  return `
    <div class="jn-wrap">
      ${slide.items.map((it, i) => `
        <div class="jn" style="background: ${NOTE_PAPERS[(it.n - 1) % NOTE_PAPERS.length]}; transform: rotate(${[-2.2, 1.6, -1.2][i % 3]}deg)">
          <span class="jn-no">no. ${it.n}</span>
          <h3>${rich(it.text)}</h3>
          <svg class="jn-heart" width="64" height="58" viewBox="0 0 120 110" fill="none">
            <path d="M60 96C26 72 10 54 12 34 14 16 32 8 46 14c8 4 12 10 14 18 2-8 8-16 18-18 16-4 30 8 28 26-2 20-20 38-46 58" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>`).join('')}
    </div>`;
}

// Never have I ever: a scorecard — four statements per slide, each with a "me" and "you" circle to tick.
function scorecard(slide) {
  return `
    <div class="sc-wrap">
      <div class="sc">
        <div class="sc-head"><span>Never have I ever…</span><b>Me</b><b>You</b></div>
        ${slide.items.map((it) => `
          <div class="sc-row">
            <span class="sc-n">${pad(it.n)}</span>
            <span class="sc-text">${rich(it.text)}</span>
            <i></i><i></i>
          </div>`).join('')}
        <div class="sc-foot">Tick yours, tick theirs, compare</div>
      </div>
    </div>`;
}

// Bucket list: a passport page — four inked stamps per slide, each with a blank date to fill in.
const STAMP_INKS = ['#D93556', '#1D5BD8', '#0B8A62', '#5E4CCB'];
const STAMP_SHAPES = ['round', 'rect', 'rect', 'round'];
function passport(slide) {
  return `
    <div class="pp-wrap">
      <div class="pp">
        <div class="pp-head"><span>Our bucket list</span><span>Page ${pad(slide.page)}</span></div>
        <div class="pp-grid">
          ${slide.items.map((it, i) => `
            <div class="pp-stamp ${STAMP_SHAPES[(it.n + i) % 4]}" style="--ink: ${STAMP_INKS[(it.n - 1) % 4]}; transform: rotate(${[-8, 6, 5, -6][i % 4]}deg)">
              <small>${esc(it.tag ?? 'Approved')}</small>
              <b>${rich(it.text)}</b>
              <span>Date: ______</span>
            </div>`).join('')}
        </div>
        <div class="pp-foot">Valid for: the two of us</div>
      </div>
    </div>`;
}

// Moving in: a cardboard moving box per question — tape, marker label, shipping label, "this side up".
function movingBox(slide, total) {
  return `
    <div class="mb-wrap" style="transform: rotate(${slide.n % 2 ? -1.4 : 1.2}deg)">
      <div class="mb">
        <span class="mb-tape"></span>
        <div class="mb-marker">Box ${slide.n} · ${esc(slide.label)}</div>
        <div class="mb-label">
          <div class="mb-label-head"><span>Open together</span><span>${pad(slide.n)} / ${pad(total)}</span></div>
          <h2>${rich(slide.text)}</h2>
        </div>
        <div class="mb-foot"><span class="mb-up">↑↑</span><span>This side up</span><span class="mb-fragile">Fragile</span></div>
      </div>
    </div>`;
}

// Say this instead: the old phrase struck through in red pen, the better phrase written underneath.
function swapCard(slide, total) {
  return `
    <div class="sw-wrap" style="transform: rotate(${slide.n % 2 ? -1 : 1}deg)">
      <div class="sw">
        <div class="sw-top"><span>Swap ${pad(slide.n)} / ${pad(total)}</span></div>
        <div class="sw-label">Instead of</div>
        <div class="sw-old">${rich(slide.old)}</div>
        <svg class="sw-arrow" width="60" height="80" viewBox="0 0 60 80" fill="none"><path d="M30 6c-6 22 6 40 0 64M14 54l16 18 16-18" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div class="sw-label">Try</div>
        <h2>${rich(slide.new)}</h2>
      </div>
    </div>`;
}

// Couples bingo: a 4×4 card with L·O·V·E column headers and one FREE square.
const LOVE_INKS = ['#FF4D6D', '#2E5BFF', '#0B8A62', '#C2185B'];
function bingo(slide) {
  return `
    <div class="bg-wrap">
      <div class="bg">
        <div class="bg-edition">${esc(slide.edition)}</div>
        <div class="bg-letters">${['L', 'O', 'V', 'E'].map((l, i) => `<b style="color:${LOVE_INKS[i]}">${l}</b>`).join('')}</div>
        <div class="bg-grid">
          ${slide.squares.map((sq) => sq === 'FREE'
            ? '<div class="bg-sq free"><span>free</span></div>'
            : `<div class="bg-sq"><span>${rich(sq)}</span></div>`).join('')}
        </div>
        <div class="bg-foot">How many did you get? Comment your score</div>
      </div>
    </div>`;
}

// When they're stressed: a tea bag per tip — crimped top, staple, string up to a tag.
function teaBag(slide, total) {
  return `
    <div class="tb-wrap" style="transform: rotate(${slide.n % 2 ? -1.6 : 1.6}deg)">
      <svg class="tb-string" width="200" height="200" viewBox="0 0 200 200" fill="none">
        <path d="M100 200C100 140 60 110 80 60S140 20 150 0" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
      </svg>
      <div class="tb-tag"><b>No. ${slide.n}</b><span>steep with care</span></div>
      <div class="tb">
        <span class="tb-staple"></span>
        <div class="tb-head">Comfort ${pad(slide.n)} / ${pad(total)}</div>
        <div class="tb-body">${'<div class="tip"><h2>' + rich(slide.title) + '</h2><p>' + rich(slide.body) + '</p></div>'}</div>
      </div>
    </div>`;
}

// Anniversary questions: one frame of film per question — sprocket holes, edge print, frame number.
function filmFrame(slide, total) {
  return `
    <div class="fm-wrap" style="transform: rotate(${slide.n % 2 ? -1.2 : 1.2}deg)">
      <div class="fm">
        <div class="fm-holes"></div>
        <div class="fm-edge"><span>Anniversary 400</span><span>${slide.n}A ▸</span></div>
        <div class="fm-frame">
          <div class="fm-n">Frame ${pad(slide.n)} of ${pad(total)}</div>
          <h2>${rich(slide.text)}</h2>
        </div>
        <div class="fm-edge"><span>▸ ${slide.n + 1}</span><span>Anniversary 400</span></div>
        <div class="fm-holes"></div>
      </div>
    </div>`;
}

// Say vs. mean: a dictionary entry — headword, pronunciation, part of speech, definition, example.
function dictEntry(slide, total) {
  return `
    <div class="dc-wrap" style="transform: rotate(${slide.n % 2 ? -1 : 1}deg)">
      <div class="dc">
        <div class="dc-head"><span>The couples dictionary</span><span>${pad(slide.n)} / ${pad(total)}</span></div>
        <h2 class="dc-word">${rich(slide.word)}</h2>
        <div class="dc-say"><i>${esc(slide.say)}</i> · <span>${esc(slide.pos ?? 'phrase')}</span></div>
        <div class="dc-def"><b>1.</b><span>${rich(slide.means)}</span></div>
        <div class="dc-eg">e.g. ${rich(slide.example)}</div>
      </div>
    </div>`;
}

// Love-language dates: a recipe card — serves 2, ingredients and method.
function recipe(slide, total) {
  return `
    <div class="rx-wrap" style="transform: rotate(${slide.n % 2 ? -1.2 : 1.2}deg)">
      <div class="rx">
        <div class="rx-top"><span>Recipe ${pad(slide.n)} / ${pad(total)}</span><span>${esc(slide.language)}</span></div>
        <h2>${rich(slide.title)}</h2>
        <div class="rx-meta"><span>Serves 2</span><span>Prep ${esc(slide.prep ?? '10 min')}</span><span>Effort ${esc(slide.effort ?? 'low')}</span></div>
        <div class="rx-cols">
          <div><b>Ingredients</b><ul>${slide.ingredients.map((x) => `<li>${rich(x)}</li>`).join('')}</ul></div>
          <div><b>Method</b><ol>${slide.method.map((x) => `<li>${rich(x)}</li>`).join('')}</ol></div>
        </div>
      </div>
    </div>`;
}

// More romantic than flowers: a gallery wall — framed abstract artwork and a museum wall label.
const ARTS = [
  'radial-gradient(circle at 35% 40%, #FF4D6D 0 22%, transparent 23%), radial-gradient(circle at 65% 62%, #FFE7A0 0 26%, transparent 27%), #2D2952',
  '#FFB38A',
  'radial-gradient(ellipse at 50% 70%, #88E3B5 0 30%, transparent 31%), radial-gradient(circle at 50% 35%, #FF4D6D 0 16%, transparent 17%), #FFF6E5',
];
function exhibit(slide, total) {
  return `
    <div class="ms-wrap">
      <div class="ms-frame"><div class="ms-art" style="background: ${ARTS[(slide.n - 1) % ARTS.length]}"></div></div>
      <div class="ms-label">
        <div class="ms-no">No. ${pad(slide.n)} of ${pad(total)}</div>
        <h3>${rich(slide.title)}</h3>
        <p><b>Artist:</b> you, probably</p>
        <p><b>Medium:</b> ${esc(slide.medium)}</p>
        <p><b>On view:</b> every day</p>
      </div>
    </div>`;
}

// Mystery date: three wax-sealed envelopes to pick from…
function envelopes(slide) {
  return `
    <div class="ev-wrap">
      <div class="ev-head">${esc(slide.prompt ?? 'Pick one. Swipe to open.')}</div>
      ${[1, 2, 3].map((n, i) => `
        <div class="ev" style="transform: rotate(${[-2, 1.5, -1][i]}deg)">
          <span class="ev-flap"></span>
          <span class="ev-seal" style="background: ${['#C2185B', '#2E5BFF', '#0B8A62'][i]}">${n}</span>
        </div>`).join('')}
    </div>`;
}
// …and the opened letters with the dates inside.
function letters(slide) {
  return `
    <div class="lt2-wrap">
      ${slide.items.map((it, i) => `
        <div class="lt2" style="transform: rotate(${[-1.5, 1.2, -0.8][i]}deg)">
          <span class="lt2-seal" style="background: ${['#C2185B', '#2E5BFF', '#0B8A62'][i]}">${i + 1}</span>
          <div><small>You picked ${i + 1}</small><h3>${rich(it.title)}</h3><p>${rich(it.body)}</p></div>
        </div>`).join('')}
    </div>`;
}

// How to apologize: flat-pack assembly instructions — big step number, a line diagram, parts note.
const MANUAL_ICONS = {
  say: '<svg width="150" height="120" viewBox="0 0 150 120" fill="none"><path d="M20 14h110a10 10 0 0 1 10 10v50a10 10 0 0 1-10 10H60l-26 22V84H20a10 10 0 0 1-10-10V24a10 10 0 0 1 10-10z" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><path d="M36 42h78M36 60h52" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg>',
  own: '<svg width="150" height="120" viewBox="0 0 150 120" fill="none"><path d="M75 104C34 78 16 58 18 36 20 18 36 10 50 14c12 4 20 12 25 24 5-12 13-20 25-24 14-4 30 4 32 22 2 22-16 42-57 68z" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><path d="M40 60h70" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 12"/></svg>',
  feel: '<svg width="150" height="120" viewBox="0 0 150 120" fill="none"><path d="M60 20c-24 0-38 20-34 44 3 18 18 22 18 38 0 8 6 12 14 12 14 0 18-14 26-26 10-14 22-22 22-40 0-16-18-28-46-28z" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><path d="M56 56c0-10 18-12 20 0 1 8-10 10-10 18" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg>',
  ask: '<svg width="150" height="120" viewBox="0 0 150 120" fill="none"><circle cx="75" cy="60" r="46" stroke="currentColor" stroke-width="6"/><path d="M60 46c0-14 30-16 30 2 0 12-15 12-15 26" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><circle cx="75" cy="88" r="4.5" fill="currentColor"/></svg>',
  change: '<svg width="150" height="120" viewBox="0 0 150 120" fill="none"><path d="M30 60a45 45 0 0 1 78-30M120 60a45 45 0 0 1-78 30" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M110 12v20H90M40 108V88h20" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
function manual(slide, total) {
  return `
    <div class="mn2-wrap">
      <div class="mn2">
        <div class="mn2-head"><span>Assembly · Apology (×1)</span><span>Step ${slide.n} / ${total}</span></div>
        <div class="mn2-row">
          <div class="mn2-num">${slide.n}</div>
          <div class="mn2-icon">${MANUAL_ICONS[slide.icon] ?? ''}</div>
        </div>
        <h2>${rich(slide.title)}</h2>
        <p>${rich(slide.body)}</p>
        <div class="mn2-foot">${esc(slide.parts ?? 'Parts needed: 1 × ego (set aside)')}</div>
      </div>
    </div>`;
}

// Trivia: a quiz answer sheet — question, a "my guess" line, a "their answer" line, a score box.
function quizSheet(slide, total) {
  return `
    <div class="qz-wrap" style="transform: rotate(${slide.n % 2 ? -1.2 : 1.2}deg)">
      <div class="qz">
        <div class="qz-head"><b>Question ${slide.n}</b><span>${pad(slide.n)} / ${pad(total)}</span></div>
        <h2>${rich(slide.text)}</h2>
        <div class="qz-lines">
          <div><small>My guess</small><i></i></div>
          <div><small>Their answer</small><i></i></div>
        </div>
        <div class="qz-score"><span>Point?</span><b></b><em>yes</em><b></b><em>no</em></div>
      </div>
    </div>`;
}

// Stopped / started: two road signs — a red no-entry sign for the old habit, a green go sign for the new one.
function roadSigns(slide, total) {
  return `
    <div class="rs-wrap">
      <div class="rs-head">Change ${pad(slide.n)} / ${pad(total)}</div>
      <div class="rs-row">
        <div class="rs-sign stop"><i></i></div>
        <div><small>Stop</small><h3>${rich(slide.old)}</h3></div>
      </div>
      <div class="rs-post"></div>
      <div class="rs-row">
        <div class="rs-sign go"><svg width="70" height="60" viewBox="0 0 70 60" fill="none"><path d="M6 30h50M38 10l20 20-20 20" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div><small>Start</small><h3>${rich(slide.new)}</h3>${slide.note ? `<p class="rs-note">${rich(slide.note)}</p>` : ''}</div>
      </div>
    </div>`;
}

// Phone-free dinner: a cracked fortune cookie above a paper slip with the question.
function fortune(slide, total) {
  return `
    <div class="fc-wrap">
      <svg class="fc-cookie" width="420" height="230" viewBox="0 0 420 230" fill="none">
        <path d="M20 170C30 60 120 20 190 40c-20 40-24 90-6 140-60 10-120 6-164-10z" fill="#E9A84C"/>
        <path d="M400 170C390 60 300 20 230 40c20 40 24 90 6 140 60 10 120 6 164-10z" fill="#E09A3E"/>
        <path d="M60 150c30-40 70-70 110-80M360 150c-30-40-70-70-110-80" stroke="#F6C877" stroke-width="8" stroke-linecap="round"/>
      </svg>
      <div class="fc-slip" style="transform: rotate(${slide.n % 2 ? -2 : 2}deg)">
        <div class="fc-head"><span>Your fortune</span><span>${pad(slide.n)} / ${pad(total)}</span></div>
        <h2>${rich(slide.text)}</h2>
      </div>
    </div>`;
}

// Myths busted: a newspaper clipping — masthead, MYTH headline, the truth as body copy, a BUSTED stamp.
function newsClip(slide, total) {
  return `
    <div class="nw-wrap" style="transform: rotate(${slide.n % 2 ? -1.6 : 1.4}deg)">
      <div class="nw">
        <div class="nw-mast">The Daily Couple</div>
        <div class="nw-meta"><span>Myth ${pad(slide.n)} of ${pad(total)}</span></div>
        <div class="nw-kicker">Myth</div>
        <h2>${rich(slide.myth)}</h2>
        <div class="nw-cols"><p><b>The truth:</b> ${rich(slide.truth)}</p></div>
        <div class="nw-stamp">Busted</div>
      </div>
    </div>`;
}

// Weekly check-in: a weather-forecast card per question.
const WX = {
  sun: { ink: '#3A1C10', em: '#B8441E', bg: '#FFE3CF', icon: '<svg width="170" height="170" viewBox="0 0 170 170" fill="none"><circle cx="85" cy="85" r="38" fill="#FFB020"/><g stroke="#FFB020" stroke-width="9" stroke-linecap="round"><path d="M85 14v18M85 138v18M14 85h18M138 85h18M35 35l13 13M122 122l13 13M35 135l13-13M122 48l13-13"/></g></svg>' },
  cloud: { ink: '#0F1E4A', em: '#1D5BD8', bg: '#E6F1FF', icon: '<svg width="200" height="150" viewBox="0 0 200 150" fill="none"><circle cx="70" cy="56" r="30" fill="#FFE7A0"/><path d="M50 128h110a30 30 0 0 0 0-60 44 44 0 0 0-84-8 34 34 0 0 0-26 68z" fill="#FFFFFF" stroke="#8EB4E8" stroke-width="4"/></svg>' },
  rain: { bg: '#6E7BB8', icon: '<svg width="200" height="170" viewBox="0 0 200 170" fill="none"><path d="M50 100h110a30 30 0 0 0 0-60 44 44 0 0 0-84-8 34 34 0 0 0-26 68z" fill="#FFFFFF"/><g stroke="#8EC5FF" stroke-width="8" stroke-linecap="round"><path d="M70 120l-10 24M105 120l-10 24M140 120l-10 24"/></g></svg>' },
  rainbow: { ink: '#0B2E22', em: '#0B6E4F', bg: '#E3F8EC', icon: '<svg width="220" height="130" viewBox="0 0 220 130" fill="none"><g stroke-width="14" stroke-linecap="round" fill="none"><path d="M20 120a90 90 0 0 1 180 0" stroke="#FF4D6D"/><path d="M40 120a70 70 0 0 1 140 0" stroke="#FFB020"/><path d="M60 120a50 50 0 0 1 100 0" stroke="#2E5BFF"/></g></svg>' },
  moon: { bg: '#3D3870', icon: '<svg width="170" height="170" viewBox="0 0 170 170"><path d="M110 22a66 66 0 1 0 40 108A56 56 0 0 1 110 22z" fill="#FFE7A0"/></svg>' },
};
function weather(slide, total) {
  const w = WX[slide.icon] ?? WX.sun;
  return `
    <div class="wx-wrap" style="transform: rotate(${slide.n % 2 ? -1 : 1}deg)">
      <div class="wx" style="background: ${w.bg}; color: ${w.ink ?? '#FFFFFF'}; --wxem: ${w.em ?? '#FFE7A0'}">
        <div class="wx-head"><span>Weekly check-in</span><span>${pad(slide.n)} / ${pad(total)}</span></div>
        <div class="wx-icon">${w.icon}</div>
        <div class="wx-temp">${esc(slide.forecast)}</div>
        <h2>${rich(slide.text)}</h2>
        ${slide.body ? `<p>${rich(slide.body)}</p>` : ''}
      </div>
    </div>`;
}

// ---- Flexible "k" cards: one shared layout, a different object design per variant (post.variant). ----
const seeded = (n) => { let x = n * 9301 + 49297; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); };
const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
function sleeper(x, y, rot, skin, shirt) {
  return `<g transform="rotate(${rot} ${x} ${y + 50})"><rect x="${x - 26}" y="${y + 6}" width="52" height="110" rx="26" fill="${shirt}"/><circle cx="${x}" cy="${y}" r="21" fill="${skin}"/></g>`;
}
const BEDS = {
  spoon: () => sleeper(132, 70, 0, '#F1C3A2', '#FF9EC4') + sleeper(168, 74, 0, '#A26B4A', '#2E5BFF'),
  back: () => sleeper(118, 72, -4, '#F1C3A2', '#FF9EC4') + sleeper(182, 72, 4, '#A26B4A', '#2E5BFF'),
  starfish: () => `<path d="M150 120l-70-40M150 120l70-40M150 150l-60 50M150 150l60 50" stroke="#FF9EC4" stroke-width="18" stroke-linecap="round"/>` + sleeper(150, 70, 0, '#F1C3A2', '#FF9EC4') + sleeper(262, 80, 0, '#A26B4A', '#2E5BFF'),
  tangle: () => sleeper(138, 70, 24, '#F1C3A2', '#FF9EC4') + sleeper(162, 70, -24, '#A26B4A', '#2E5BFF'),
  cliff: () => sleeper(52, 72, 0, '#F1C3A2', '#FF9EC4') + sleeper(248, 72, 0, '#A26B4A', '#2E5BFF'),
  chest: () => sleeper(170, 70, 0, '#A26B4A', '#2E5BFF') + sleeper(112, 116, 62, '#F1C3A2', '#FF9EC4'),
};
const VARIANTS = {
  rain: { label: () => '',
    top: (s) => { const r = seeded(s.n); return `<div class="k-window">${Array.from({ length: 14 }, () => `<i style="left:${(r() * 92).toFixed(0)}%;top:${(r() * 80).toFixed(0)}%"></i>`).join('')}</div>`; } },
  podium: { label: () => 'Pet name ranking',
    top: (s) => `<div class="k-pod" style="height:${70 + (8 - s.rank) * 26}px"><span>#${s.rank}</span></div>` },
  dice: { label: () => '',
    top: (s) => `<svg class="k-die" width="170" height="170" viewBox="0 0 100 100"><rect x="4" y="4" width="92" height="92" rx="20" fill="#FFFFFF" stroke="${t.accentOnCard}" stroke-width="5"/>${PIPS[s.n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="${t.accentOnCard}"/>`).join('')}</svg>` },
  badge: { label: () => 'Achievement unlocked',
    top: (s) => `<svg width="150" height="164" viewBox="0 0 100 110"><path d="M50 4l42 24v54L50 106 8 82V28z" fill="${t.accentOnCard}"/><path d="M50 16l32 18v42L50 94 18 76V34z" fill="#FFE7A0"/><text x="50" y="68" text-anchor="middle" font-family="Serif" font-size="38" fill="${t.accentOnCard}">${s.n}</text></svg>`,
  },
  bubble: { label: (s, n) => s.result ? 'Your results' : `Question ${s.n} / ${n - 1}`,
    bottom: (s) => `<div class="k-opts">${s.options.map((o, i) => `<div><b>${'ABCDE'[i]}</b><span>${rich(o.replace(/^[A-E] /, ''))}</span></div>`).join('')}</div>` },
  napkin: { label: (s) => `Leave it: ${esc(s.where)}` },
  stars: { label: () => '',
    top: (s, n) => `<div class="k-chart">${Array.from({ length: n }, (_, i) => `<i class="${i < s.n ? 'on' : ''}">${i < s.n ? '★' : ''}</i>`).join('')}</div>` },
  depth: { label: (s) => `Depth: ${esc(s.depth)}`,
    top: (s, n) => `<div class="k-gauge"><b style="top:${((s.n - 0.5) / n) * 100}%"></b></div>` },
  clapper: { label: (s, n) => `Rule ${pad(s.n)} / ${pad(n)} · Take 1`,
    top: () => `<div class="k-clap"></div>` },
  lock: { label: (s) => esc(s.clock),
    top: (s) => `<div class="k-time">${esc(s.clock)}</div>` },
  seeds: { label: () => '',
    top: (s) => `<div class="k-seedart"><svg width="240" height="225" viewBox="0 0 160 150"><path d="M80 150V70" stroke="#2F9E77" stroke-width="7"/><path d="M80 100c-30 0-40-20-40-30 20 0 40 10 40 30zM80 90c30 0 40-20 40-30-20 0-40 10-40 30z" fill="#2F9E77"/>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="80" cy="42" rx="14" ry="26" fill="${['#FF4D6D', '#FF9EC4', '#FFB38A', '#FFD93D', '#C3B1FF'][s.n % 5]}" transform="rotate(${a} 80 56)"/>`).join('')}<circle cx="80" cy="56" r="13" fill="#FFE7A0"/></svg></div>` },
  wheel: { label: () => '',
    top: (s) => { const cols = ['#FF4D6D', '#FFD93D', '#88E3B5', '#8EC5FF', '#C3B1FF', '#FFB38A']; const seg = (i) => { const a0 = (i * 60 - 90) * Math.PI / 180, a1 = ((i + 1) * 60 - 90) * Math.PI / 180;
      return `<path d="M100 100L${100 + 90 * Math.cos(a0)} ${100 + 90 * Math.sin(a0)}A90 90 0 0 1 ${100 + 90 * Math.cos(a1)} ${100 + 90 * Math.sin(a1)}z" fill="${cols[i]}" opacity="${i === (s.n - 1) % 6 ? 1 : 0.35}"/>`; };
      return `<svg width="270" height="284" viewBox="0 0 200 210"><g transform="rotate(${-(s.n - 1) * 60 - 30} 100 110)" >${[0, 1, 2, 3, 4, 5].map(seg).join('')}</g><circle cx="100" cy="100" r="14" fill="#FFFFFF" stroke="#1A1A1A" stroke-width="4"/><path d="M88 0h24l-12 22z" fill="#1A1A1A"/></svg>`.replace('rotate(', 'translate(0 10) rotate('); } },
  cassette: { label: () => '',
    bottom: () => `<div class="k-reels"><i></i><span></span><i></i></div>` },
  hazard: { label: (s) => `Caution ${pad(s.n)}`,
    top: () => `<svg width="150" height="132" viewBox="0 0 100 88"><path d="M50 4l46 80H4z" fill="#FFD93D" stroke="#1A1A1A" stroke-width="6" stroke-linejoin="round"/><rect x="45" y="30" width="10" height="30" rx="5" fill="#1A1A1A"/><circle cx="50" cy="70" r="6" fill="#1A1A1A"/></svg>` },
  advent: { label: (s, n) => `Day ${s.n} of ${n}`,
    top: (s) => `<div class="k-door"><span>${s.n}</span><i></i></div>` },
  matches: { label: () => '',
    top: () => `<svg width="70" height="190" viewBox="0 0 70 190"><path d="M35 8c16 18 18 38 0 52-18-14-16-34 0-52z" fill="#FFB020"/><path d="M35 26c8 10 9 22 0 30-9-8-8-20 0-30z" fill="#FFE7A0"/><circle cx="35" cy="66" r="12" fill="#C2185B"/><rect x="30" y="74" width="10" height="112" rx="3" fill="#E9C793"/></svg>` },
  rating: { label: () => '',
    bottom: () => `<div class="k-scale">${Array.from({ length: 10 }, (_, i) => `<i>${i + 1}</i>`).join('')}</div>` },
  capsule: { label: () => '',
    top: () => `<svg width="130" height="160" viewBox="0 0 130 160"><rect x="25" y="8" width="80" height="22" rx="6" fill="${t.accentOnCard}"/><path d="M18 34h94v104a16 16 0 0 1-16 16H34a16 16 0 0 1-16-16z" fill="#FFFFFF" fill-opacity=".6" stroke="${t.accentOnCard}" stroke-width="5"/><rect x="34" y="96" width="30" height="40" rx="4" fill="#FFB38A"/><rect x="62" y="108" width="34" height="28" rx="4" fill="#FF9EC4"/><path d="M48 60l34 0" stroke="${t.accentOnCard}" stroke-width="5" stroke-linecap="round"/></svg>` },
  comic: { label: () => '' },
  mission: { label: () => '',
    top: () => `<svg width="120" height="170" viewBox="0 0 120 170"><path d="M60 6c26 22 36 56 30 100H30C24 62 34 28 60 6z" fill="#FFFFFF"/><circle cx="60" cy="62" r="16" fill="#8EC5FF" stroke="#1F1B3A" stroke-width="5"/><path d="M30 92l-18 34 22-6zM90 92l18 34-22-6z" fill="#FF4D6D"/><path d="M44 112c4 24 10 36 16 50 6-14 12-26 16-50z" fill="#FFB020"/></svg>` },
  stopwatch: { label: () => '',
    top: () => `<svg width="150" height="170" viewBox="0 0 150 170"><rect x="60" y="4" width="30" height="20" rx="5" fill="#1A1A1A"/><circle cx="75" cy="98" r="64" fill="#FFFFFF" stroke="#1A1A1A" stroke-width="8"/><path d="M75 98V54" stroke="${t.accentOnCard}" stroke-width="8" stroke-linecap="round"/><text x="75" y="136" text-anchor="middle" font-family="Inter" font-weight="700" font-size="22" fill="#1A1A1A">60s</text></svg>` },
  clock: { label: (s) => esc(s.time),
    top: (s) => { const [h, m] = s.time.split(/[: ]/).map(Number); const ha = ((h % 12) + m / 60) * 30, ma = m * 6;
      return `<svg width="170" height="170" viewBox="0 0 170 170"><circle cx="85" cy="85" r="78" fill="#FFFFFF" stroke="${t.accentOnCard}" stroke-width="8"/>${Array.from({ length: 12 }, (_, i) => `<path d="M85 16v12" stroke="#0F1E4A" stroke-width="5" stroke-linecap="round" transform="rotate(${i * 30} 85 85)"/>`).join('')}<path d="M85 85V44" stroke="#0F1E4A" stroke-width="8" stroke-linecap="round" transform="rotate(${ha} 85 85)"/><path d="M85 85V26" stroke="${t.accentOnCard}" stroke-width="5" stroke-linecap="round" transform="rotate(${ma} 85 85)"/><circle cx="85" cy="85" r="7" fill="#0F1E4A"/></svg>`; } },
  house: { label: (s) => esc(s.room) },
  bed: { label: () => '',
    top: (s) => `<svg width="560" height="430" viewBox="0 0 300 230"><rect x="10" y="10" width="280" height="210" rx="22" fill="#FFFFFF" stroke="#C3B1FF" stroke-width="6"/><rect x="40" y="26" width="96" height="40" rx="14" fill="#EDE7FF"/><rect x="164" y="26" width="96" height="40" rx="14" fill="#EDE7FF"/><path d="M13 132h274v66a19 19 0 0 1-19 19H32a19 19 0 0 1-19-19z" fill="#C3B1FF" opacity=".45"/>${BEDS[s.pos]()}</svg>` },
  rosette: { label: (s) => `Award: ${esc(s.award)}`,
    top: () => `<svg width="130" height="180" viewBox="0 0 130 180"><path d="M40 90l-18 82 26-14 14 22 6-80zM90 90l18 82-26-14-14 22-6-80z" fill="${t.accentOnCard}"/>${Array.from({ length: 16 }, (_, i) => `<circle cx="65" cy="20" r="14" fill="#FFD93D" transform="rotate(${i * 22.5} 65 70)"/>`).join('')}<circle cx="65" cy="70" r="40" fill="#FFD93D"/><circle cx="65" cy="70" r="30" fill="#FFFFFF"/><path d="M65 88c-14-10-20-16-20-24a9 9 0 0 1 20-4 9 9 0 0 1 20 4c0 8-6 14-20 24z" fill="${t.accentOnCard}"/></svg>` },
  plate: { label: () => '',
    top: (s) => `<div class="k-lplate"><small>Road trip</small><b>Q · ${pad(s.n)}</b><i></i><i></i></div>` },
  wave: { label: () => '',
    top: (s) => { const r = seeded(s.n + 3); return `<div class="k-wave">${Array.from({ length: 34 }, (_, i) => `<i class="${i < 13 ? 'on' : ''}" style="height:${(16 + r() * 84).toFixed(0)}%"></i>`).join('')}</div>`; } },
  thermo: { label: () => '',
    top: (s, n) => `<svg width="80" height="220" viewBox="0 0 80 220"><rect x="26" y="6" width="28" height="170" rx="14" fill="#FFFFFF" stroke="#1A1A1A" stroke-width="5"/><circle cx="40" cy="188" r="26" fill="#FF4D6D" stroke="#1A1A1A" stroke-width="5"/><rect x="33" y="${170 - (s.n / n) * 150}" width="14" height="${(s.n / n) * 150 + 10}" fill="#FF4D6D"/></svg>` },
  hanger: { label: () => '' },
  candle: { label: () => '',
    top: () => `<svg width="130" height="180" viewBox="0 0 130 180"><path d="M65 8c14 16 16 32 0 44-16-12-14-28 0-44z" fill="#FFB020"/><path d="M65 24c7 8 8 18 0 24-8-6-7-16 0-24z" fill="#FFE7A0"/><path d="M65 52v14" stroke="#1A1A1A" stroke-width="4"/><path d="M14 66h102v90a18 18 0 0 1-18 18H32a18 18 0 0 1-18-18z" fill="#FFF4E0"/><rect x="28" y="96" width="74" height="44" rx="6" fill="${t.accentOnCard}"/></svg>` },
  boxing: { label: (s) => `Round ${s.n}`,
    top: (s) => `<div class="k-round">Round ${s.n}</div>` },
  contract: { label: (s) => `Clause ${s.n}`,
    bottom: () => `<div class="k-sign"><div><i></i><span>Signed</span></div><div><i></i><span>Signed</span></div></div>` },
};
function kcard(slide, total, v) {
  const V = VARIANTS[v];
  return `
    <div class="k-wrap k-${v}${slide.body || V.bottom ? '' : ' solo'}" style="transform: rotate(${slide.n % 2 ? -1.2 : 1.2}deg)">
      <div class="k">
        ${V.top ? `<div class="k-top">${V.top(slide, total)}</div>` : ''}
        ${V.label(slide, total) ? `<div class="k-label">${V.label(slide, total)}</div>` : ''}
        <h2>${rich(slide.title)}</h2>
        ${slide.body ? `<p>${rich(slide.body)}</p>` : ''}
        ${V.bottom ? V.bottom(slide, total) : ''}
      </div>
    </div>`;
}

const CARD_STYLES = { stack: cardStack, ticket, sticky, tracker, receipt, chat, postcard, notebook, calm: (slide, total) => calm(slide, total) };

let t;
function slideBody(slide, qTotal, post, theme) {
  t = theme;
  const card = CARD_STYLES[post.cardStyle ?? 'stack'];
  const illo = ILLUSTRATIONS[post.illustration];
  switch (slide.type) {
    case 'cover':
      return `
        <main class="open">
          ${illo ? `<div class="illo">${illo({ a: t.illo, pop: t.accentOnBg, card: t.card, back1: t.back1, back2: t.back2 })}</div>` : ''}
          <h1>${rich(slide.title)}</h1>
          ${slide.sub ? `<p class="sub">${rich(slide.sub)}</p>` : ''}
        </main>
        <footer><span class="swipe">Swipe ${ICONS.arrow}</span></footer>`;
    case 'question':
      if (post.cardStyle === 'calm') return calm(slide, qTotal);
      return card(slide, qTotal, `<h2>${rich(slide.text)}</h2>`);
    case 'tip':
      return card(slide, qTotal, `
        <div class="tip">
          <h2>${rich(slide.title)}</h2>
          <p>${rich(slide.body)}</p>
        </div>`);
    case 'idea':
      return polaroid(slide, qTotal);
    case 'list':
      return strips(slide, t);
    case 'pair':
      return dealPair(slide);
    case 'menu':
      return menu(slide);
    case 'coupons':
      return coupons(slide);
    case 'tags':
      return luggage(slide);
    case 'folder':
      return folder(slide, qTotal);
    case 'report':
      return report(slide, qTotal);
    case 'calendar':
      return calendarPage(slide);
    case 'file':
      return caseFile(slide, qTotal);
    case 'blank':
      return blankCard(slide, qTotal);
    case 'flag':
      return flagCard(slide, qTotal);
    case 'notes':
      return loveNotes(slide);
    case 'checks':
      return scorecard(slide);
    case 'stamps':
      return passport(slide);
    case 'box':
      return movingBox(slide, qTotal);
    case 'swap':
      return swapCard(slide, qTotal);
    case 'bingo':
      return bingo(slide);
    case 'teabag':
      return teaBag(slide, qTotal);
    case 'film':
      return filmFrame(slide, qTotal);
    case 'dict':
      return dictEntry(slide, qTotal);
    case 'recipe':
      return recipe(slide, qTotal);
    case 'exhibit':
      return exhibit(slide, qTotal);
    case 'envelopes':
      return envelopes(slide);
    case 'letters':
      return letters(slide);
    case 'manual':
      return manual(slide, qTotal);
    case 'scratch':
      return quizSheet(slide, qTotal);
    case 'signs':
      return roadSigns(slide, qTotal);
    case 'fortune':
      return fortune(slide, qTotal);
    case 'news':
      return newsClip(slide, qTotal);
    case 'weather':
      return weather(slide, qTotal);
    case 'k':
      return kcard(slide, qTotal, post.variant);
    case 'choice':
      return versus(slide, qTotal);
    case 'save':
      return `
        <main class="open">
          <div class="icon">${ICONS.bookmark}</div>
          <h2>${rich(slide.title)}</h2>
          ${slide.sub ? `<p class="sub">${rich(slide.sub)}</p>` : ''}
        </main>
        <footer><span class="lockup">${lockup(t)}</span></footer>`;
    default:
      throw new Error(`Unknown slide type: ${slide.type}`);
  }
}

function html(slide, post) {
  const t = THEMES[post.theme];
  const qTotal = post.slides.filter((s) => ['question', 'tip', 'choice', 'idea', 'pair', 'folder', 'report', 'calendar', 'file', 'blank', 'flag', 'box', 'swap', 'teabag', 'film', 'dict', 'recipe', 'exhibit', 'manual', 'scratch', 'signs', 'fortune', 'news', 'weather', 'k'].includes(s.type) && !s.result).length + (post.slides.some((s) => s.result) ? 1 : 0);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Serif; src: url('${brandFonts}/DMSerifDisplay-Regular.ttf'); }
  @font-face { font-family: Serif; font-style: italic; src: url('${brandFonts}/DMSerifDisplay-Italic.ttf'); }
  @font-face { font-family: Script; src: url('${brandFonts}/CaveatBrush-Regular.ttf'); }
  @font-face { font-family: Inter; font-weight: 400; src: url('${uiFonts}/inter_regular.ttf'); }
  @font-face { font-family: Inter; font-weight: 500; src: url('${uiFonts}/inter_medium.ttf'); }
  @font-face { font-family: Inter; font-weight: 600; src: url('${uiFonts}/inter_semibold.ttf'); }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body { background: ${t.bg}; color: ${t.onBg}; font-family: Inter, sans-serif; position: relative; }
  em { font-style: italic; color: ${t.accentOnBg}; }

  /* Fixed grid: 88px margins; series label on top; content below. */
  /* Everything is centered on the vertical axis: label, cover/save content, footer. */
  header { position: absolute; left: 88px; right: 88px; top: 88px; display: flex; justify-content: center; }
  .lockup svg { height: 80px; width: auto; display: block; }
  .icon { color: ${t.accentOnBg}; margin-bottom: 48px; }
  .illo svg { width: 560px; height: auto; display: block; margin: 0 auto 64px; }
  .label { font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onBgMuted}; }
  footer { position: absolute; left: 88px; right: 88px; bottom: 88px; display: flex; justify-content: center; }

  main.open { position: absolute; left: 88px; right: 88px; top: 150px; bottom: 170px;
              display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  h1 { font-family: Serif; font-weight: 400; font-size: 108px; line-height: 1.0; letter-spacing: -1.5px; text-wrap: balance; }
  h2 { font-family: Serif; font-weight: 400; font-size: 92px; line-height: 1.08; letter-spacing: -1.2px; text-wrap: balance; }
  .sub { font-size: 34px; line-height: 1.45; color: ${t.onBgMuted}; margin-top: 40px; max-width: 820px; text-wrap: balance; }
  .sub em { font-style: normal; color: ${t.onBg}; }
  .swipe { display: flex; align-items: center; gap: 20px; font-size: 24px; font-weight: 600; letter-spacing: 4px;
           text-transform: uppercase; color: ${t.onBgMuted}; }

  /* White question card on top of a fanned stack of two flat back cards. */
  .stack { position: absolute; left: 96px; right: 96px; top: 150px; bottom: 158px; }
  .back, .card { position: absolute; inset: 0; border-radius: 44px; }
  .b2 { background: ${t.back2}; transform: rotate(4deg) translate(22px, 14px); }
  .b1 { background: ${t.back1}; transform: rotate(-3deg) translate(-12px, 8px); }
  .card { background: ${t.card}; color: ${t.onCard}; padding: 76px 72px 68px;
          display: flex; flex-direction: column; box-shadow: 0 30px 60px rgba(0,0,0,0.28); }
  .card em { color: ${t.accentOnCard}; }
  .card h2 { margin: auto 0; text-wrap: pretty; }
  .tip { margin: auto 0; }
  .tip h2 { margin: 0; font-size: 84px; text-wrap: balance; }
  .tip p { margin-top: 40px; font-size: 38px; line-height: 1.45; color: ${t.onCard}; opacity: .68; text-wrap: pretty; }
  .tip p em { opacity: 1; }
  .tip p em { font-style: normal; font-weight: 600; color: ${t.onCard}; }
  .card-foot { display: flex; justify-content: space-between; align-items: center; }
  .count { font-size: 24px; font-weight: 600; letter-spacing: 2px; color: ${t.onCardMuted}; }
  .bar { width: 240px; height: 3px; background: ${t.onCardMuted}; opacity: .5; border-radius: 2px; position: relative; }
  .bar b { position: absolute; left: 0; top: 0; bottom: 0; background: ${t.onCard}; border-radius: 2px; }

  /* Polaroid: white frame, square-ish illustrated photo, caption underneath, two polaroids fanned behind. */
  .pol-wrap { position: absolute; left: 140px; right: 140px; top: 120px; bottom: 120px; }
  .pol { position: absolute; inset: 0; background: #FFFFFF; color: ${t.onCard}; border-radius: 10px; padding: 44px 44px 0;
         display: flex; flex-direction: column; box-shadow: 0 2px 4px rgba(60,30,10,0.06), 0 30px 60px -12px rgba(60,30,10,0.28); }
  .pol.back { padding: 0; }
  .pol.p2 { transform: rotate(6deg) translate(34px, 16px); }
  .pol.p1 { transform: rotate(-5deg) translate(-26px, 10px); }
  .pol em { color: ${t.accentOnCard}; }
  .pol-photo { position: relative; height: 560px; border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .pol-photo svg { width: 600px; height: auto; }
  .pol-stamp { position: absolute; right: 26px; bottom: 18px; font-family: Script; font-size: 40px; color: ${t.onCard}; opacity: .7; transform: rotate(-4deg); }
  .pol-caption { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 12px; }
  .pol-caption h2 { font-size: 64px; }
  .pol-caption p { margin-top: 16px; font-size: 30px; line-height: 1.4; color: ${t.onCard}; opacity: .65; text-wrap: pretty; }
  .pol-count { position: absolute; right: 44px; top: 616px; font-size: 20px; font-weight: 600; letter-spacing: 3px; color: ${t.onCardMuted}; display: none; }

  /* Habit tracker: white card, habit text, a 7-day row of ticked circles and a streak line. */
  .tr-wrap { position: absolute; left: 110px; right: 110px; top: 150px; bottom: 150px; }
  .tr-back { position: absolute; inset: 0; border-radius: 44px; background: ${t.back1}; transform: rotate(4.5deg) translate(22px, 12px); }
  .tr { position: absolute; inset: 0; border-radius: 44px; background: ${t.card}; color: ${t.onCard}; padding: 64px 68px 60px;
        display: flex; flex-direction: column; box-shadow: 0 30px 60px rgba(0,0,0,0.18); }
  .tr em { color: ${t.accentOnCard}; }
  .tr-head { display: flex; justify-content: space-between; font-size: 22px; font-weight: 600; letter-spacing: 3px;
             text-transform: uppercase; color: ${t.onCardMuted}; }
  .tr-body { flex: 1; display: flex; }
  .tr-body .tip h2 { font-size: 78px; }
  .tr-week { display: flex; justify-content: space-between; padding: 30px 0 0; border-top: 2px solid ${t.onCardMuted}; border-top-color: rgba(0,0,0,0.08); }
  .tr-day { display: flex; flex-direction: column; align-items: center; gap: 12px; font-size: 22px; font-weight: 600; color: ${t.onCardMuted}; }
  .tr-day i { width: 64px; height: 64px; border-radius: 50%; border: 3px solid rgba(0,0,0,0.12); display: flex; align-items: center; justify-content: center; }
  .tr-day.on i { background: ${t.accentOnCard}; border-color: ${t.accentOnCard}; }
  .tr-foot { display: flex; align-items: center; gap: 12px; margin-top: 28px; font-size: 26px; font-weight: 600; color: ${t.onCard}; }
  .tr-foot svg { color: #FF4D6D; }

  /* Receipt: white slip with a zigzag torn bottom (mask), monospace details, shadow on the wrapper. */
  .rc-wrap { position: absolute; left: 170px; right: 170px; top: 110px; bottom: 96px; filter: drop-shadow(0 24px 30px rgba(90,20,40,0.25)); }
  .rc { position: absolute; inset: 0; background: ${t.card}; color: ${t.onCard}; padding: 60px 60px 70px;
        display: flex; flex-direction: column; font-family: 'Courier New', monospace; border-radius: 8px 8px 0 0;
        -webkit-mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 36px 100%; }
  .rc em { color: ${t.accentOnCard}; }
  .rc-head { text-align: center; }
  .rc-head b { display: block; font-size: 34px; letter-spacing: 6px; text-transform: uppercase; }
  .rc-head span { display: block; margin-top: 10px; font-size: 22px; color: ${t.onCardMuted}; }
  .rc-rule { border-top: 3px dashed rgba(0,0,0,0.25); margin: 30px 0; }
  .rc-body { flex: 1; display: flex; font-family: Inter, sans-serif; }
  .rc-body .tip h2 { font-size: 66px; }
  .rc-body .tip p { font-size: 32px; margin-top: 24px; }
  .rc-line { display: flex; align-items: center; gap: 14px; font-size: 28px; margin: 6px 0; }
  .rc-line i { flex: 1; border-bottom: 3px dotted rgba(0,0,0,0.25); transform: translateY(6px); }
  .dots { display: flex; gap: 8px; }
  .dots b { width: 20px; height: 20px; border-radius: 50%; border: 3px solid ${t.onCard}; }
  .dots b.on { background: ${t.accentOnCard}; border-color: ${t.accentOnCard}; }
  .rc-thanks { text-align: center; font-size: 24px; letter-spacing: 3px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .rc-barcode { height: 56px; margin: 24px 60px 0;
                background: repeating-linear-gradient(90deg, ${t.onCard} 0 3px, transparent 3px 7px, ${t.onCard} 7px 8px, transparent 8px 13px, ${t.onCard} 13px 17px, transparent 17px 20px); }

  /* Chat screen: header with avatar, a sent coral bubble holding the question, partner typing, input bar. */
  .ch-wrap { position: absolute; left: 120px; right: 120px; top: 110px; bottom: 110px; }
  .ch { position: absolute; inset: 0; background: ${t.card}; color: ${t.onCard}; border-radius: 60px; overflow: hidden;
        display: flex; flex-direction: column; box-shadow: 0 30px 60px rgba(0,0,0,0.3); border: 12px solid #14112A; }
  .ch-head { display: flex; align-items: center; gap: 20px; padding: 40px 44px 28px; border-bottom: 2px solid rgba(0,0,0,0.06); }
  .ch-avatar { width: 76px; height: 76px; border-radius: 50%; background: #FF4D6D; display: flex; align-items: center; justify-content: center; }
  .ch-head b { display: block; font-size: 32px; font-weight: 600; }
  .ch-head small { display: block; margin-top: 4px; font-size: 22px; color: ${t.onCardMuted}; }
  .ch-body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 40px; }
  .ch-time { text-align: center; font-size: 22px; font-weight: 500; color: ${t.onCardMuted}; margin-bottom: 30px; }
  .ch-sent { align-self: flex-end; max-width: 92%; background: #FF4D6D; color: #FFFFFF; padding: 36px 44px 40px;
             border-radius: 44px 44px 12px 44px; }
  .ch-sent h2 { font-size: 64px; line-height: 1.12; }
  .ch-sent em { color: #FFE7A0; }
  .ch-read { align-self: flex-end; margin-top: 10px; font-size: 20px; font-weight: 500; color: ${t.onCardMuted}; }
  .ch-typing { align-self: flex-start; display: flex; gap: 10px; margin-top: 30px; background: #F0EEF5; padding: 26px 30px;
               border-radius: 36px 36px 36px 12px; }
  .ch-typing i { width: 16px; height: 16px; border-radius: 50%; background: #B9B4C9; }
  .ch-typing i:nth-child(2) { background: #9F99B3; } .ch-typing i:nth-child(3) { background: #8780A0; }
  .ch-input { display: flex; align-items: center; justify-content: space-between; margin: 0 32px 36px; padding: 18px 18px 18px 32px;
              border: 2px solid rgba(0,0,0,0.1); border-radius: 999px; font-size: 26px; color: ${t.onCardMuted}; }
  .ch-input b { width: 58px; height: 58px; border-radius: 50%; background: #FF4D6D; display: flex; align-items: center; justify-content: center; }

  /* Postcard: landscape card, message column + address column split by a rule, stamp and postmark. */
  .pc-wrap { position: absolute; left: 64px; right: 64px; top: 290px; bottom: 290px; }
  .pc { position: absolute; inset: 0; background: #FFFBF4; color: ${t.onCard}; border-radius: 14px; padding: 52px 48px;
        display: grid; grid-template-columns: 1.3fr 1fr; gap: 0; box-shadow: 0 30px 60px rgba(0,0,0,0.25); }
  .pc.back { display: block; background: #F3EBDD; transform: rotate(5deg) translate(26px, 18px); }
  .pc em { color: ${t.accentOnCard}; }
  .pc-msg { display: flex; flex-direction: column; padding-right: 40px; border-right: 3px solid rgba(0,0,0,0.1); }
  .pc-meta { font-size: 20px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .pc-msg .tip { margin: auto 0; }
  .pc-msg .tip h2 { font-size: 58px; }
  .pc-msg .tip p { font-size: 28px; margin-top: 22px; }
  .pc-side { display: flex; flex-direction: column; justify-content: space-between; padding-left: 36px; }
  .pc-stamp-row { display: flex; justify-content: flex-end; align-items: flex-start; position: relative; }
  .pc-postmark { color: ${t.accentOnCard}; opacity: .55; position: absolute; right: 86px; top: 30px; transform: rotate(-12deg); }
  .pc-stamp { display: block; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.12)); transform: rotate(3deg); }
  .pc-addr div { display: flex; align-items: flex-end; gap: 14px; border-bottom: 3px solid rgba(0,0,0,0.12); height: 70px; padding-bottom: 6px; }
  .pc-addr small { font-size: 20px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: ${t.onCardMuted}; width: 64px; }
  .pc-addr span { font-family: Script; font-size: 42px; color: ${t.onCard}; line-height: 1; }

  /* Notebook page: ruled blue lines, red margin, three punch holes, handwritten header, doodle. */
  .nb-wrap { position: absolute; left: 110px; right: 110px; top: 130px; bottom: 130px; }
  .nb { position: absolute; inset: 0; border-radius: 10px; color: #1A1A1A; padding: 70px 70px 60px 150px;
        display: flex; flex-direction: column; box-shadow: 0 30px 60px rgba(80,20,0,0.28);
        background:
          linear-gradient(90deg, transparent 116px, #F2A2A2 116px 120px, transparent 120px),
          repeating-linear-gradient(180deg, transparent 0 58px, #DCE6F5 58px 61px) 0 34px / 100% 100% no-repeat,
          #FFFDF7; }
  .nb.back { background: #F4ECDD; transform: rotate(5deg) translate(24px, 14px); }
  .nb em { color: ${t.accentOnCard}; }
  .nb-hole { position: absolute; left: 40px; width: 40px; height: 40px; margin-top: -20px; border-radius: 50%; background: ${t.bg};
             box-shadow: inset 0 3px 4px rgba(0,0,0,0.18); }
  .nb-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 22px; font-weight: 600;
             letter-spacing: 3px; text-transform: uppercase; color: rgba(26,26,26,0.4); }
  .nb-head .hand { font-family: Script; font-size: 52px; letter-spacing: 0; text-transform: none; color: ${t.accentOnCard}; transform: rotate(-3deg); }
  .nb-body { flex: 1; display: flex; }
  .nb-body .tip h2 { font-size: 74px; }
  .nb-body .tip p { font-size: 32px; line-height: 61px; margin-top: 20px; }
  .nb-doodle { position: absolute; right: 60px; bottom: 54px; color: ${t.accentOnCard}; opacity: .8; transform: rotate(10deg); }

  /* Strips: three stacked game cards with a big number column. */
  .st-wrap { position: absolute; left: 90px; right: 90px; top: 120px; bottom: 120px; display: flex; flex-direction: column; justify-content: space-between; }
  .st { height: 322px; border-radius: 36px; color: #0B0B0B; display: flex; align-items: center; gap: 36px; padding: 0 56px 0 44px;
        box-shadow: 0 18px 36px rgba(0,0,0,0.18); }
  .st-num { font-family: Serif; font-size: 120px; line-height: 1; opacity: .9; min-width: 150px; text-align: center; }
  .st-label { font-size: 20px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; opacity: .55; margin-bottom: 12px; }
  .st h3 { font-family: Serif; font-weight: 400; font-size: 56px; line-height: 1.1; letter-spacing: -0.5px; text-wrap: balance; }
  .st em { font-style: italic; color: #0B0B0B; }

  /* Playing cards: Truth (cream) and Dare (coral) dealt side by side, slightly fanned. */
  .pl-table { position: absolute; left: 0; right: 0; top: 300px; height: 700px; }
  .pl-slot { position: absolute; top: 0; width: 440px; height: 660px; }
  .pl-slot.l { left: 90px; transform: rotate(-5deg); }
  .pl-slot.r { right: 90px; top: 30px; transform: rotate(5deg); }
  .pl { position: absolute; inset: 0; border-radius: 30px; padding: 22px; box-shadow: 0 30px 50px rgba(0,0,0,0.5); }
  .pl.truth { background: #FFF6E5; color: #141414; }
  .pl.dare { background: #FF4D6D; color: #FFFFFF; }
  .pl-face { position: absolute; inset: 22px; border: 3px solid currentColor; border-radius: 20px; opacity: 1;
             display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 40px; }
  .pl.truth .pl-face { border-color: rgba(20,20,20,0.15); }
  .pl.dare .pl-face { border-color: rgba(255,255,255,0.35); }
  .pl-icon { margin-bottom: 18px; }
  .pl.truth .pl-icon { color: #FFD60A; } .pl.dare .pl-icon { color: #FFE7A0; }
  .pl-kind { font-size: 22px; font-weight: 600; letter-spacing: 6px; text-transform: uppercase; opacity: .6; margin-bottom: 20px; }
  .pl h3 { font-family: Serif; font-weight: 400; font-size: 44px; line-height: 1.14; text-wrap: balance; }
  .pl.truth em { font-style: italic; color: #B8860B; }
  .pl.dare em { font-style: italic; color: #FFE7A0; }
  .pl-idx { position: absolute; display: flex; flex-direction: column; align-items: center; line-height: 1; z-index: 1; padding: 6px; border-radius: 10px; }
  .pl.truth .pl-idx { background: #FFF6E5; } .pl.dare .pl-idx { background: #FF4D6D; }
  .pl-idx b { font-family: Serif; font-weight: 400; font-size: 46px; }
  .pl-idx span { font-size: 20px; font-weight: 600; margin-top: 4px; }
  .pl-idx.tl { left: 34px; top: 30px; }
  .pl-idx.br { right: 34px; bottom: 30px; transform: rotate(180deg); }

  /* Menu card: cream stock, double inset rule, centered course header, numbered courses. */
  .mn-wrap { position: absolute; left: 100px; right: 100px; top: 80px; bottom: 80px; }
  .mn { position: absolute; inset: 0; background: #FFFDF7; color: ${t.onCard}; border-radius: 6px; padding: 70px 76px;
        display: flex; flex-direction: column; align-items: center; text-align: center;
        box-shadow: 0 30px 60px rgba(11,46,34,0.22), inset 0 0 0 18px #FFFDF7, inset 0 0 0 20px rgba(184,134,11,0.55),
                    inset 0 0 0 26px #FFFDF7, inset 0 0 0 27px rgba(184,134,11,0.35); }
  .mn em { color: ${t.accentOnCard}; }
  .mn-top { font-size: 20px; font-weight: 600; letter-spacing: 6px; text-transform: uppercase; color: ${t.onCardMuted}; margin-top: 6px; }
  .mn-course { margin-top: 26px; font-family: Serif; font-style: italic; font-size: 30px; color: #B8860B; }
  .mn-course span { color: ${t.onCardMuted}; }
  .mn-title { margin-top: 6px; font-family: Serif; font-weight: 400; font-size: 76px; line-height: 1.05; }
  .mn-sub { margin-top: 8px; font-family: Script; font-size: 40px; color: ${t.accentOnCard}; }
  .mn-rule { width: 160px; border-top: 2px solid rgba(184,134,11,0.6); margin: 26px 0 10px; position: relative; }
  .mn-items { list-style: none; padding: 0; margin: 0; width: 100%; flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; }
  .mn-items li { display: flex; align-items: baseline; gap: 22px; text-align: left; padding: 14px 0;
                 border-bottom: 2px dotted rgba(11,46,34,0.18); }
  .mn-items li:last-child { border-bottom: 0; }
  .mn-items b { font-family: Serif; font-style: italic; font-weight: 400; font-size: 34px; color: #B8860B; min-width: 44px; }
  .mn-items span { font-family: Serif; font-size: 36px; line-height: 1.22; text-wrap: pretty; }
  .mn-foot { font-size: 18px; font-weight: 600; letter-spacing: 5px; text-transform: uppercase; color: ${t.onCardMuted}; }

  /* Coupons: dashed cut line around each coupon, colored FREE stub, perforated seam. */
  .cp-wrap { position: absolute; left: 70px; right: 70px; top: 110px; bottom: 110px; display: flex; flex-direction: column; justify-content: space-between; }
  .cp-cut { position: relative; height: 520px; border: 4px dashed ${t.onBgMuted}; border-radius: 34px; padding: 18px; }
  .cp-scissors { position: absolute; left: 50px; top: -27px; background: ${t.bg}; padding: 0 8px; color: ${t.onBg}; transform: rotate(-90deg); }
  .cp { height: 100%; display: flex; border-radius: 22px; overflow: hidden; background: #FFFBF6; color: ${t.onCard};
        box-shadow: 0 20px 40px rgba(90,40,20,0.2); }
  .cp-stub { width: 170px; background: ${t.accentOnCard}; color: #FFFBF6; display: flex; flex-direction: column; align-items: center;
             justify-content: center; gap: 18px; border-right: 4px dashed rgba(255,251,246,0.6); }
  .cp-stub b { font-family: Serif; font-weight: 400; font-size: 64px; writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: 2px; }
  .cp-stub span { font-size: 20px; font-weight: 600; letter-spacing: 2px; }
  .cp-main { flex: 1; padding: 44px 50px 36px; display: flex; flex-direction: column; }
  .cp-label { font-size: 20px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .cp-main h3 { margin-top: 14px; font-family: Serif; font-weight: 400; font-size: 64px; line-height: 1.05; text-wrap: balance; }
  .cp-main em { color: ${t.accentOnCard}; }
  .cp-main p { margin-top: 18px; font-size: 30px; line-height: 1.4; opacity: .7; text-wrap: pretty; }
  .cp-foot { margin-top: auto; display: flex; justify-content: space-between; font-size: 20px; font-weight: 600; letter-spacing: 3px;
             text-transform: uppercase; color: ${t.onCardMuted}; border-top: 2px solid rgba(0,0,0,0.08); padding-top: 18px; }

  /* Calm card: big soft card, breathing orb with rings, step line, question, tip, progress dots. */
  .cm-wrap { position: absolute; left: 100px; right: 100px; top: 110px; bottom: 110px; }
  .cm { position: absolute; inset: 0; border-radius: 64px; background: ${t.card}; color: ${t.onCard}; padding: 90px 84px 80px;
        display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; box-shadow: 0 30px 70px rgba(29,91,216,0.16); }
  .cm em { color: ${t.accentOnCard}; }
  .cm-orb { width: 170px; height: 170px; border-radius: 50%; margin-top: -40px; display: flex; align-items: center; justify-content: center;
            background: #8EC5FF;
            box-shadow: 0 0 0 34px rgba(142,197,255,0.22), 0 0 0 72px rgba(142,197,255,0.1); }
  .cm-orb span { font-family: Serif; font-size: 76px; color: ${t.accentOnCard}; }
  .cm-step { margin-top: 110px; font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .cm h2 { margin-top: 30px; font-size: 80px; line-height: 1.1; text-wrap: balance; }
  .cm-tip { margin-top: 36px; font-size: 32px; line-height: 1.45; color: ${t.onCard}; opacity: .62; max-width: 700px; text-wrap: balance; }
  .cm-dots { position: absolute; bottom: 76px; display: flex; gap: 14px; }
  .cm-dots i { width: 14px; height: 14px; border-radius: 50%; background: rgba(15,30,74,0.12); }
  .cm-dots i.on { background: ${t.accentOnCard}; }

  /* Luggage tags: notched left end, hole + string, colored band. */
  .lt-wrap { position: absolute; left: 90px; right: 70px; top: 120px; bottom: 120px; display: flex; flex-direction: column; justify-content: space-around; }
  .lt-item { position: relative; height: 470px; }
  .lt-string { position: absolute; left: -139px; top: -61px; z-index: 2; pointer-events: none; }
  .lt { position: absolute; inset: 0; background: #FFFFFF; color: ${t.onCard}; display: flex; flex-direction: column;
        clip-path: polygon(70px 0, 100% 0, 100% 100%, 70px 100%, 0 calc(100% - 70px), 0 70px); filter: drop-shadow(0 0 0 transparent); }
  .lt-item::after { content: ''; position: absolute; inset: 0; z-index: -1; transform: translate(10px, 16px); background: rgba(31,27,58,0.12);
                    clip-path: polygon(70px 0, 100% 0, 100% 100%, 70px 100%, 0 calc(100% - 70px), 0 70px); filter: blur(6px); }
  .lt em { color: ${t.accentOnCard}; }
  .lt-hole { position: absolute; left: 34px; top: 50%; width: 46px; height: 46px; margin-top: -23px; border-radius: 50%;
             background: ${t.bg}; box-shadow: 0 0 0 9px ${t.back2}; }
  .lt-band { margin-left: 110px; background: ${t.back1}; color: ${t.onCard}; font-size: 20px; font-weight: 600; letter-spacing: 4px;
             text-transform: uppercase; padding: 18px 40px; }
  .lt-body { flex: 1; margin-left: 110px; padding: 30px 50px 36px 40px; display: flex; flex-direction: column; justify-content: center;
             border-left: 3px dashed rgba(31,27,58,0.12); }
  .lt-label { font-size: 20px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .lt-body h3 { margin-top: 12px; font-family: Serif; font-weight: 400; font-size: 60px; line-height: 1.06; text-wrap: balance; }
  .lt-body p { margin-top: 16px; font-size: 29px; line-height: 1.4; opacity: .68; text-wrap: pretty; }

  /* Folder: colored tab with the style name, body with icon, sections; a second folder peeks behind. */
  .fd-wrap { position: absolute; left: 100px; right: 100px; top: 190px; bottom: 110px; }
  .fd, .fd-back { position: absolute; inset: 0; }
  .fd-back { transform: translate(26px, -30px); }
  .fd-back::before { content: ''; position: absolute; inset: 0; border-radius: 0 36px 36px 36px; background: var(--tab); opacity: .55; }
  .fd-back span { position: absolute; right: 60px; top: -62px; width: 300px; height: 70px; border-radius: 26px 26px 0 0; background: var(--tab); opacity: .55; }
  .fd-tab { position: absolute; left: 0; top: -78px; height: 82px; padding: 0 44px; border-radius: 28px 28px 0 0; background: var(--tab);
            display: flex; align-items: center; font-size: 24px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: #1A1A1A; }
  .fd-body { position: absolute; inset: 0; border-radius: 0 36px 36px 36px; background: #FFFFFF; color: ${t.onCard}; padding: 56px 64px;
             border-top: 14px solid var(--tab); display: flex; flex-direction: column; box-shadow: 0 30px 60px rgba(60,40,20,0.16); }
  .fd em { color: ${t.accentOnCard}; }
  .fd-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .fd-icon { color: #1A1A1A; }
  .fd-count { font-size: 22px; font-weight: 600; letter-spacing: 3px; color: ${t.onCardMuted}; }
  .fd-kicker { margin-top: auto; font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .fd h2 { margin-top: 6px; font-size: 92px; line-height: 1.02; }
  .fd-sec { margin-top: 40px; padding-top: 24px; border-top: 2px solid rgba(0,0,0,0.08); }
  .fd-sec b { font-size: 22px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .fd-sec p { margin-top: 10px; font-family: Serif; font-size: 46px; line-height: 1.2; text-wrap: pretty; }
  .fd-sec:last-child { margin-bottom: auto; }

  /* Report card: school-paper look, A–D grade boxes, red-pen teacher's note. */
  .rp-wrap { position: absolute; left: 100px; right: 100px; top: 110px; bottom: 110px; }
  .rp { position: absolute; inset: 0; background: #FFFDF5; color: ${t.onCard}; border-radius: 10px; padding: 60px 70px;
        display: flex; flex-direction: column; box-shadow: 0 30px 60px rgba(120,90,0,0.22);
        background-image: linear-gradient(rgba(46,91,255,0.06) 2px, transparent 2px); background-size: 100% 56px; }
  .rp em { color: ${t.accentOnCard}; }
  .rp-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 4px double rgba(0,0,0,0.25); padding-bottom: 18px; }
  .rp-head b { font-family: Serif; font-weight: 400; font-size: 40px; }
  .rp-head span { font-size: 20px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .rp-meta { display: flex; justify-content: space-between; margin-top: 18px; font-size: 24px; color: ${t.onCardMuted}; }
  .rp-meta i { font-family: Script; font-style: normal; font-size: 34px; color: #1A1A1A; }
  .rp h2 { margin-top: auto; font-size: 100px; line-height: 1; }
  .rp-prompt { margin-top: 22px; font-size: 32px; line-height: 1.45; opacity: .7; text-wrap: balance; }
  .rp-grades { margin-top: 64px; display: flex; gap: 30px; }
  .rp-grades span { width: 160px; height: 160px; border: 4px solid #1A1A1A; border-radius: 16px; display: flex; align-items: center;
                    justify-content: center; font-family: Serif; font-size: 86px; }
  .rp-note { margin-top: auto; border-top: 2px dashed rgba(0,0,0,0.2); padding-top: 22px; }
  .rp-note small { display: block; font-size: 20px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .rp-note span { display: block; margin-top: 6px; font-family: Script; font-size: 46px; color: #D93556; transform: rotate(-1.5deg); }

  /* Tear-off calendar: dark binding with rings, colored band, giant weekday, perforated bottom. */
  .cl-wrap { position: absolute; left: 150px; right: 150px; top: 120px; bottom: 120px; }
  .cl-page { position: absolute; inset: 0; background: #FFFFFF; color: ${t.onCard}; border-radius: 18px 18px 26px 26px;
             display: flex; flex-direction: column; align-items: center; text-align: center; padding: 0 60px 50px;
             box-shadow: 0 26px 50px rgba(90,40,20,0.2); overflow: hidden; }
  .cl-page.back1 { transform: translate(8px, 14px); background: #F7EFE8; box-shadow: none; }
  .cl-page.back2 { transform: translate(16px, 28px); background: #EEE2D8; box-shadow: none; }
  .cl-page em { color: ${t.accentOnCard}; }
  .cl-bind { width: calc(100% + 120px); height: 74px; background: #3A1C10; display: flex; justify-content: space-around; align-items: center; }
  .cl-bind i { width: 34px; height: 34px; border-radius: 50%; background: ${t.bg}; box-shadow: inset 0 3px 4px rgba(0,0,0,0.3); }
  .cl-band { width: calc(100% + 120px); background: ${t.accentOnCard}; color: #FFFFFF; font-size: 20px; font-weight: 600; letter-spacing: 4px;
             text-transform: uppercase; padding: 16px 0; }
  .cl-day { margin-top: auto; font-family: Serif; font-size: 230px; line-height: .9; color: ${t.accentOnCard}; letter-spacing: -4px; }
  .cl-page h3 { margin-top: 40px; font-family: Serif; font-weight: 400; font-size: 70px; line-height: 1.06; text-wrap: balance; }
  .cl-page p { margin-top: 22px; margin-bottom: auto; font-size: 32px; line-height: 1.45; opacity: .68; text-wrap: balance; }
  .cl-tear { margin-top: auto; width: calc(100% + 120px); border-top: 4px dashed rgba(0,0,0,0.14); padding-top: 14px;
             font-size: 18px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onCardMuted}; }

  /* Case file: aged paper, paperclip, red rubber stamp, redaction bar. */
  .cf-wrap { position: absolute; left: 110px; right: 110px; top: 130px; bottom: 120px; }
  .cf { position: absolute; inset: 0; background: #FBF6EA; color: #1A1A1A; border-radius: 6px; padding: 80px 70px 60px;
        display: flex; flex-direction: column; box-shadow: 0 30px 60px rgba(90,20,40,0.25); font-family: 'Courier New', monospace; }
  .cf em { color: #C2185B; font-family: Serif; }
  .cf-clip { position: absolute; top: -50px; left: 80px; }
  .cf-head { display: flex; justify-content: space-between; font-size: 26px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
             border-bottom: 3px solid #1A1A1A; padding-bottom: 14px; }
  .cf-sub { margin-top: 14px; font-size: 24px; color: rgba(26,26,26,0.6); }
  .cf-stamp { position: absolute; right: 60px; top: 190px; transform: rotate(-12deg); border: 6px solid #D93556; color: #D93556; border-radius: 10px;
              padding: 8px 20px; font-family: Inter, sans-serif; font-size: 34px; font-weight: 700; letter-spacing: 6px; text-transform: uppercase; opacity: .85; }
  .cf h2 { margin-top: auto; font-family: Serif; font-size: 84px; line-height: 1.06; text-wrap: balance; }
  .cf p { margin-top: 26px; font-size: 32px; line-height: 1.5; color: rgba(26,26,26,0.72); margin-bottom: auto; text-wrap: pretty; }
  .cf-foot { display: flex; justify-content: space-between; align-items: center; font-size: 24px; border-top: 2px dashed rgba(26,26,26,0.25); padding-top: 22px; }
  .redact { display: inline-block; width: 220px; height: 26px; background: #1A1A1A; vertical-align: middle; margin-left: 8px; }
  .cf-verdict { font-family: Script; font-size: 46px; color: #D93556; transform: rotate(-6deg); }

  /* Fill in the blank: index card with red header rule + blue lines, a real blank, a pencil. */
  .bl-wrap { position: absolute; left: 100px; right: 100px; top: 200px; bottom: 200px; }
  .bl { position: absolute; inset: 0; border-radius: 8px; color: #1F1B3A; padding: 70px 70px 60px; display: flex; flex-direction: column;
        box-shadow: 0 30px 60px rgba(30,20,80,0.28);
        background: linear-gradient(transparent 128px, #F2A2A2 128px 131px, transparent 131px),
                    repeating-linear-gradient(transparent 0 76px, #D3DEF3 76px 79px) 0 131px / 100% 100% no-repeat, #FFFFFF; }
  .bl em { color: ${t.accentOnCard}; }
  .bl-head { display: flex; justify-content: space-between; font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: rgba(31,27,58,0.45); }
  .bl h2 { margin-top: auto; margin-bottom: auto; font-size: 76px; line-height: 1.22; text-wrap: balance; }
  .bl-line { display: inline-block; width: 300px; height: 0; border-bottom: 5px solid ${t.accentOnCard}; margin: 0 6px; vertical-align: baseline; }
  .bl-chip { align-self: flex-start; font-size: 22px; font-weight: 600; letter-spacing: 2px; color: ${t.accentOnCard};
             background: rgba(94,76,203,0.1); padding: 12px 20px; border-radius: 999px; }
  .bl-pencil { position: absolute; right: -40px; bottom: 40px; transform: rotate(-24deg); filter: drop-shadow(0 6px 6px rgba(0,0,0,0.15)); }

  /* Green flag: flag + pole above the text. */
  .gf-wrap { position: absolute; left: 100px; right: 100px; top: 110px; bottom: 110px; }
  .gf { position: absolute; inset: 0; border-radius: 48px; background: #FFFFFF; color: ${t.onCard}; padding: 70px 76px;
        display: flex; flex-direction: column; justify-content: center; box-shadow: 0 30px 60px rgba(11,46,34,0.18); }
  .gf em { color: ${t.accentOnCard}; }
  .gf-flag { margin-left: -16px; }
  .gf-label { margin-top: 30px; font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .gf h2 { margin-top: 18px; font-size: 80px; line-height: 1.08; text-wrap: balance; }
  .gf p { margin-top: 26px; font-size: 34px; line-height: 1.45; opacity: .68; text-wrap: pretty; }

  /* Love-jar notes: torn paper slips with a center fold crease. */
  .jn-wrap { position: absolute; left: 90px; right: 90px; top: 110px; bottom: 110px; display: flex; flex-direction: column; justify-content: space-between; filter: drop-shadow(0 16px 18px rgba(90,30,10,0.22)); }
  .jn { position: relative; height: 330px; color: #2A1A14; padding: 0 120px 0 64px; display: flex; flex-direction: column; justify-content: center;
        clip-path: polygon(0 3%, 6% 0, 14% 2%, 22% 0, 31% 3%, 40% 1%, 49% 3%, 58% 0, 67% 2%, 76% 0, 85% 3%, 93% 1%, 100% 3%,
                           100% 97%, 94% 100%, 86% 98%, 77% 100%, 68% 97%, 59% 100%, 50% 98%, 41% 100%, 32% 97%, 23% 100%, 14% 98%, 6% 100%, 0 97%);
        background-image: linear-gradient(90deg, transparent 49.6%, rgba(0,0,0,0.05) 50%, transparent 50.4%); }
  .jn-no { font-family: Script; font-size: 44px; color: ${t.accentOnCard}; transform: rotate(-3deg); transform-origin: left; }
  .jn h3 { margin-top: 10px; font-family: Serif; font-weight: 400; font-size: 58px; line-height: 1.1; text-wrap: balance; }
  .jn em { color: ${t.accentOnCard}; }
  .jn-heart { position: absolute; right: 44px; bottom: 40px; color: ${t.accentOnCard}; opacity: .7; transform: rotate(10deg); }

  /* Scorecard: header row, four statement rows with two tick circles, footer. */
  .sc-wrap { position: absolute; left: 80px; right: 80px; top: 140px; bottom: 140px; }
  .sc { position: absolute; inset: 0; background: #FFFFFF; color: #0B0B0B; border-radius: 40px; padding: 56px 56px 44px;
        display: flex; flex-direction: column; box-shadow: 0 30px 60px rgba(0,0,0,0.22); }
  .sc em { color: ${t.accentOnCard}; }
  .sc-head { display: grid; grid-template-columns: 1fr 96px 96px; align-items: end; padding-bottom: 20px; border-bottom: 4px solid #0B0B0B; }
  .sc-head span { font-family: Serif; font-style: italic; font-size: 52px; color: ${t.accentOnCard}; }
  .sc-head b { font-size: 22px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; text-align: center; }
  .sc-row { flex: 1; display: grid; grid-template-columns: 60px 1fr 96px 96px; align-items: center; border-bottom: 2px solid rgba(0,0,0,0.08); }
  .sc-n { font-size: 22px; font-weight: 600; color: rgba(0,0,0,0.4); }
  .sc-text { font-family: Serif; font-size: 44px; line-height: 1.12; padding-right: 20px; text-wrap: balance; }
  .sc-row i { justify-self: center; width: 64px; height: 64px; border-radius: 50%; border: 4px solid #0B0B0B; }
  .sc-row i:last-child { border-color: ${t.accentOnCard}; }
  .sc-foot { padding-top: 20px; font-size: 20px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: rgba(0,0,0,0.4); text-align: center; }

  /* Passport page: guilloche-ish background, 2×2 inked stamps. */
  .pp-wrap { position: absolute; left: 90px; right: 90px; top: 110px; bottom: 110px; }
  .pp { position: absolute; inset: 0; border-radius: 18px; padding: 50px 50px 40px; display: flex; flex-direction: column; color: #2A1A14;
        box-shadow: 0 30px 60px rgba(60,40,10,0.2);
        background: repeating-radial-gradient(circle at 50% 50%, transparent 0 22px, rgba(11,138,98,0.05) 22px 24px), #FBF3E2; }
  .pp-head { display: flex; justify-content: space-between; font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase;
             color: rgba(42,26,20,0.5); border-bottom: 2px solid rgba(42,26,20,0.15); padding-bottom: 16px; }
  .pp-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 26px; padding: 30px 0; }
  .pp-stamp { align-self: center; justify-self: center; color: var(--ink); border: 6px double var(--ink); padding: 26px 20px;
              display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px;
              mix-blend-mode: multiply; opacity: .92; }
  .pp-stamp.round { width: 360px; height: 360px; border-radius: 50%; }
  .pp-stamp.rect { width: 380px; height: 300px; border-radius: 14px; }
  .pp-stamp small { font-size: 20px; font-weight: 700; letter-spacing: 5px; text-transform: uppercase; }
  .pp-stamp b { font-family: Serif; font-weight: 400; font-size: 40px; line-height: 1.08; text-wrap: balance; }
  .pp-stamp b em { font-style: italic; color: var(--ink); }
  .pp-stamp span { font-size: 18px; font-weight: 600; letter-spacing: 2px; }
  .pp-foot { font-family: Script; font-size: 38px; color: rgba(42,26,20,0.6); text-align: right; }

  /* Moving box: kraft cardboard, tape, marker label, white shipping label. */
  .mb-wrap { position: absolute; left: 100px; right: 100px; top: 150px; bottom: 150px; }
  .mb { position: absolute; inset: 0; border-radius: 10px; padding: 120px 70px 50px; display: flex; flex-direction: column;
        background: #D2A577; box-shadow: 0 30px 60px rgba(0,0,0,0.4), inset 0 0 0 3px rgba(0,0,0,0.06); }
  .mb-tape { position: absolute; left: -10px; right: -10px; top: 40px; height: 62px; background: rgba(240,224,190,0.75);
             box-shadow: 0 2px 4px rgba(0,0,0,0.08); }
  .mb-marker { font-family: Script; font-size: 64px; color: #2A1A10; transform: rotate(-2deg); }
  .mb-label { margin-top: auto; margin-bottom: auto; background: #FFFFFF; border-radius: 8px; padding: 40px 44px 46px; color: #1A1A1A; box-shadow: 0 6px 12px rgba(0,0,0,0.12); }
  .mb-label em { color: ${t.accentOnCard}; }
  .mb-label-head { display: flex; justify-content: space-between; font-size: 20px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase;
                   color: rgba(0,0,0,0.45); border-bottom: 2px dashed rgba(0,0,0,0.15); padding-bottom: 14px; }
  .mb-label h2 { margin-top: 22px; font-size: 64px; line-height: 1.12; text-wrap: balance; }
  .mb-foot { display: flex; align-items: center; gap: 18px; font-size: 22px; font-weight: 700; letter-spacing: 4px;
             text-transform: uppercase; color: rgba(42,26,16,0.75); }
  .mb-up { font-size: 40px; letter-spacing: -6px; }
  .mb-fragile { margin-left: auto; border: 4px solid #B3261E; color: #B3261E; padding: 6px 16px; border-radius: 8px; transform: rotate(-6deg); }

  /* Swap: red-pen strikethrough on the old phrase, the better one written large below. */
  .sw-wrap { position: absolute; left: 100px; right: 100px; top: 130px; bottom: 130px; }
  .sw { position: absolute; inset: 0; background: #FFFFFF; color: ${t.onCard}; border-radius: 44px; padding: 70px 76px;
        display: flex; flex-direction: column; justify-content: center; box-shadow: 0 30px 60px rgba(90,40,20,0.18); }
  .sw-top { position: absolute; top: 56px; left: 76px; right: 76px; font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .sw-label { font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .sw-old { margin-top: 12px; font-family: Serif; font-size: 66px; line-height: 1.1; color: rgba(58,28,16,0.45);
            text-decoration: line-through; text-decoration-color: #D93556; text-decoration-thickness: 6px; }
  .sw-arrow { margin: 22px 0 18px; color: ${t.accentOnCard}; }
  .sw h2 { margin-top: 12px; font-size: 76px; line-height: 1.1; color: ${t.onCard}; text-wrap: balance; }
  .sw h2 em { color: ${t.accentOnCard}; }

  /* Bingo: L·O·V·E header, 4×4 squares, a filled FREE square. */
  .bg-wrap { position: absolute; left: 70px; right: 70px; top: 100px; bottom: 100px; }
  .bg { position: absolute; inset: 0; background: #FFFFFF; color: #0B0B0B; border-radius: 40px; padding: 44px 44px 36px;
        display: flex; flex-direction: column; box-shadow: 0 30px 60px rgba(120,90,0,0.22); }
  .bg em { color: ${t.accentOnCard}; }
  .bg-edition { text-align: center; font-size: 22px; font-weight: 600; letter-spacing: 5px; text-transform: uppercase; color: rgba(0,0,0,0.45); }
  .bg-letters { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; margin: 6px 0 16px; }
  .bg-letters b { font-family: Serif; font-weight: 400; font-size: 100px; line-height: 1; }
  .bg-grid { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); gap: 14px; }
  .bg-sq { background: #FFF7D1; border-radius: 18px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 12px; }
  .bg-sq span { font-family: Serif; font-size: 29px; line-height: 1.12; text-wrap: balance; }
  .bg-sq.free { background: ${t.accentOnCard}; }
  .bg-sq.free span { font-family: Script; font-size: 56px; color: #FFFFFF; }
  .bg-foot { margin-top: 18px; text-align: center; font-size: 20px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: rgba(0,0,0,0.45); }

  /* Tea bag: crimped paper bag with a staple, string to a colored tag. */
  .tb-wrap { position: absolute; left: 150px; right: 150px; top: 260px; bottom: 130px; }
  .tb-string { position: absolute; left: 50%; top: -200px; margin-left: -100px; z-index: 0; }
  .tb-tag { position: absolute; left: 50%; top: -230px; transform: translateX(10px) rotate(6deg); background: ${t.accentOnCard}; color: #FFFFFF;
            width: 230px; padding: 18px 20px; border-radius: 10px; text-align: center; z-index: 1; box-shadow: 0 10px 20px rgba(0,0,0,0.15); }
  .tb-tag b { display: block; font-family: Serif; font-weight: 400; font-size: 40px; }
  .tb-tag span { font-family: Script; font-size: 30px; opacity: .9; }
  .tb { position: absolute; inset: 0; background: #FFFDF8; color: ${t.onCard}; padding: 110px 70px 70px; display: flex; flex-direction: column;
        clip-path: polygon(0 3%, 4% 0, 8% 3%, 12% 0, 16% 3%, 20% 0, 24% 3%, 28% 0, 32% 3%, 36% 0, 40% 3%, 44% 0, 48% 3%, 52% 0, 56% 3%, 60% 0, 64% 3%, 68% 0, 72% 3%, 76% 0, 80% 3%, 84% 0, 88% 3%, 92% 0, 96% 3%, 100% 0, 100% 100%, 0 100%);
        background-image: radial-gradient(rgba(150,120,80,0.10) 1.5px, transparent 1.6px); background-size: 22px 22px; border-radius: 0 0 24px 24px; }
  .tb-wrap::after { content: ''; position: absolute; inset: 0; z-index: -1; transform: translate(8px, 18px); background: rgba(15,30,74,0.16); filter: blur(10px); border-radius: 24px; }
  .tb em { color: ${t.accentOnCard}; }
  .tb-staple { position: absolute; left: 50%; top: 40px; width: 60px; height: 10px; margin-left: -30px; border-radius: 5px; background: #B7BCC8; }
  .tb-head { text-align: center; font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .tb-body { flex: 1; display: flex; text-align: center; }
  .tb-body .tip h2 { font-size: 76px; }
  .tb-body .tip p { font-size: 34px; margin-top: 28px; }

  /* Film frame: black strip, sprocket holes top and bottom, orange edge print, cream frame. */
  .fm-wrap { position: absolute; left: 40px; right: 40px; top: 190px; bottom: 190px; }
  .fm { position: absolute; inset: 0; background: #141414; border-radius: 10px; padding: 0 40px; display: flex; flex-direction: column;
        box-shadow: 0 30px 60px rgba(0,0,0,0.6); }
  .fm-holes { height: 70px; background: repeating-linear-gradient(90deg, transparent 0 26px, #2E2E2E 26px 62px, transparent 62px 88px)
              center / 100% 34px no-repeat; }
  .fm-edge { display: flex; justify-content: space-between; font-family: 'Courier New', monospace; font-size: 22px; font-weight: 700;
             letter-spacing: 3px; color: #FF9F0A; text-transform: uppercase; padding: 0 10px; }
  .fm-frame { flex: 1; margin: 14px 0; border-radius: 8px; background: #FFF3DA; color: #2A1A10;
              display: flex; flex-direction: column; justify-content: center; padding: 50px 70px; }
  .fm-frame em { color: #B8441E; }
  .fm-n { font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: rgba(42,26,16,0.5); }
  .fm-frame h2 { margin-top: 20px; font-size: 74px; line-height: 1.1; text-wrap: balance; }

  /* Dictionary entry: headword, pronunciation, numbered definition, example. */
  .dc-wrap { position: absolute; left: 100px; right: 100px; top: 150px; bottom: 150px; }
  .dc { position: absolute; inset: 0; background: #FDFBF6; color: #1F1B3A; border-radius: 12px; padding: 64px 70px; display: flex; flex-direction: column;
        justify-content: center; box-shadow: 0 30px 60px rgba(31,27,58,0.2); border-left: 14px solid ${t.accentOnCard}; }
  .dc em { color: ${t.accentOnCard}; }
  .dc-head { position: absolute; top: 50px; left: 70px; right: 70px; display: flex; justify-content: space-between; font-size: 22px; font-weight: 600;
             letter-spacing: 4px; text-transform: uppercase; color: rgba(31,27,58,0.45); border-bottom: 2px solid rgba(31,27,58,0.1); padding-bottom: 16px; }
  .dc-word { font-size: 96px; line-height: 1.02; }
  .dc-say { margin-top: 16px; font-size: 30px; color: rgba(31,27,58,0.55); }
  .dc-say i { font-family: Serif; font-size: 34px; }
  .dc-say span { font-style: italic; }
  .dc-def { margin-top: 44px; display: flex; gap: 22px; font-family: Serif; font-size: 52px; line-height: 1.16; }
  .dc-def b { font-weight: 400; color: ${t.accentOnCard}; }
  .dc-eg { margin-top: 30px; padding-left: 50px; font-size: 30px; font-style: italic; line-height: 1.45; color: rgba(31,27,58,0.6); }

  /* Recipe card: index-card stock, colored top rule, meta chips, two columns. */
  .rx-wrap { position: absolute; left: 90px; right: 90px; top: 150px; bottom: 150px; }
  .rx { position: absolute; inset: 0; background: #FFFDF7; color: ${t.onCard}; border-radius: 14px; padding: 60px 64px; display: flex; flex-direction: column;
        border-top: 22px solid ${t.accentOnCard}; box-shadow: 0 30px 60px rgba(11,46,34,0.2);
        background-image: repeating-linear-gradient(transparent 0 54px, rgba(11,138,98,0.08) 54px 56px); }
  .rx em { color: ${t.accentOnCard}; }
  .rx-top { display: flex; justify-content: space-between; font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .rx h2 { margin-top: 26px; font-size: 80px; line-height: 1.04; }
  .rx-meta { display: flex; gap: 14px; margin-top: 26px; }
  .rx-meta span { font-size: 22px; font-weight: 600; letter-spacing: 1px; color: ${t.accentOnCard}; background: rgba(11,138,98,0.1); padding: 10px 18px; border-radius: 999px; }
  .rx-cols { flex: 1; display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 40px; margin-top: 40px; }
  .rx-cols b { display: block; font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onCardMuted}; margin-bottom: 18px; }
  .rx-cols ul, .rx-cols ol { margin: 0; padding-left: 30px; }
  .rx-cols li { font-family: Serif; font-size: 36px; line-height: 1.3; margin-bottom: 18px; }
  .rx-cols ol li::marker { color: ${t.accentOnCard}; font-family: Inter; font-weight: 600; }

  /* Gallery: gilded frame with abstract art, white museum label beneath. */
  .ms-wrap { position: absolute; left: 0; right: 0; top: 110px; bottom: 110px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 60px; }
  .ms-frame { width: 640px; height: 520px; padding: 26px; background: #D9B46A; border-radius: 6px;
              box-shadow: 0 30px 60px rgba(0,0,0,0.5), inset 0 0 0 4px rgba(0,0,0,0.15); }
  .ms-art { width: 100%; height: 100%; box-shadow: inset 0 0 0 14px #FBF7EE; }
  .ms-label { width: 640px; background: #FFFFFF; color: #1A1A1A; padding: 36px 44px; border-radius: 4px; box-shadow: 0 10px 24px rgba(0,0,0,0.35); }
  .ms-label em { color: #C2185B; }
  .ms-no { font-size: 18px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: rgba(0,0,0,0.45); }
  .ms-label h3 { margin: 12px 0 18px; font-family: Serif; font-weight: 400; font-style: italic; font-size: 50px; line-height: 1.1; text-wrap: balance; }
  .ms-label p { font-size: 24px; line-height: 1.5; color: rgba(0,0,0,0.7); }
  .ms-label p b { font-weight: 600; color: #1A1A1A; }

  /* Envelopes: three sealed envelopes; letters: three opened notes. */
  .ev-wrap { position: absolute; left: 140px; right: 140px; top: 120px; bottom: 120px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; }
  .ev-head { font-family: Script; font-size: 56px; color: ${t.accentOnBg}; }
  .ev { position: relative; width: 760px; height: 300px; background: #FBF1E4; border-radius: 12px; box-shadow: 0 20px 40px rgba(90,20,40,0.25); overflow: hidden; }
  .ev-flap { position: absolute; left: 0; right: 0; top: 0; height: 170px; background: #F2E2CE; clip-path: polygon(0 0, 100% 0, 50% 100%); }
  .ev-seal { position: absolute; left: 50%; top: 170px; width: 96px; height: 96px; margin: -48px 0 0 -48px; border-radius: 50%; color: #FFFFFF;
             display: flex; align-items: center; justify-content: center; font-family: Serif; font-size: 52px; box-shadow: inset 0 0 0 8px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.2); }
  .lt2-wrap { position: absolute; left: 90px; right: 90px; top: 120px; bottom: 120px; display: flex; flex-direction: column; justify-content: space-between; }
  .lt2 { height: 330px; background: #FFFDF7; border-radius: 12px; display: flex; align-items: center; gap: 40px; padding: 0 56px 0 44px; color: #1A1A1A;
         box-shadow: 0 20px 40px rgba(90,20,40,0.22); }
  .lt2-seal { flex: none; width: 96px; height: 96px; border-radius: 50%; color: #FFFFFF; display: flex; align-items: center; justify-content: center;
              font-family: Serif; font-size: 52px; box-shadow: inset 0 0 0 8px rgba(0,0,0,0.12); }
  .lt2 small { font-family: Script; font-size: 38px; color: ${t.accentOnCard}; }
  .lt2 h3 { margin-top: 4px; font-family: Serif; font-weight: 400; font-size: 58px; line-height: 1.06; text-wrap: balance; }
  .lt2 h3 em { color: ${t.accentOnCard}; }
  .lt2 p { margin-top: 12px; font-size: 28px; line-height: 1.4; opacity: .68; }

  /* Assembly manual: white sheet, blue line diagram, big circled step number. */
  .mn2-wrap { position: absolute; left: 100px; right: 100px; top: 130px; bottom: 130px; }
  .mn2 { position: absolute; inset: 0; background: #FFFFFF; color: #0B0B0B; border-radius: 10px; padding: 56px 70px; display: flex; flex-direction: column;
         box-shadow: 0 30px 60px rgba(0,0,0,0.25); }
  .mn2 em { color: ${t.accentOnCard}; }
  .mn2-head { display: flex; justify-content: space-between; font-size: 22px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;
              border-bottom: 4px solid #0B0B0B; padding-bottom: 16px; }
  .mn2-row { margin-top: auto; display: flex; align-items: center; gap: 40px; }
  .mn2-num { width: 150px; height: 150px; border-radius: 50%; border: 6px solid #0B0B0B; display: flex; align-items: center; justify-content: center;
             font-family: Inter; font-weight: 700; font-size: 84px; }
  .mn2-icon { color: ${t.accentOnCard}; }
  .mn2 h2 { margin-top: 44px; font-size: 80px; line-height: 1.06; }
  .mn2 p { margin-top: 22px; margin-bottom: auto; font-size: 34px; line-height: 1.45; opacity: .7; text-wrap: pretty; }
  .mn2-foot { font-size: 20px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: rgba(0,0,0,0.45); border-top: 2px dashed rgba(0,0,0,0.2); padding-top: 18px; }

  /* Quiz sheet: lined answer sheet, two write-in lines, yes/no score boxes. */
  .qz-wrap { position: absolute; left: 100px; right: 100px; top: 160px; bottom: 160px; }
  .qz { position: absolute; inset: 0; background: #FFFDF7; color: #1A1A1A; border-radius: 16px; padding: 60px 66px; display: flex; flex-direction: column;
        box-shadow: 0 30px 60px rgba(90,30,10,0.3); border-top: 20px solid ${t.accentOnCard}; }
  .qz em { color: ${t.accentOnCard}; }
  .qz-head { display: flex; justify-content: space-between; align-items: baseline; }
  .qz-head b { font-family: Script; font-weight: 400; font-size: 56px; color: ${t.accentOnCard}; }
  .qz-head span { font-size: 22px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: rgba(0,0,0,0.45); }
  .qz h2 { margin-top: auto; font-size: 78px; line-height: 1.1; text-wrap: balance; }
  .qz-lines { margin-top: 56px; margin-bottom: auto; display: flex; flex-direction: column; gap: 40px; }
  .qz-lines div { display: flex; align-items: flex-end; gap: 22px; }
  .qz-lines small { flex: none; font-size: 22px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: rgba(0,0,0,0.5); }
  .qz-lines i { flex: 1; border-bottom: 3px solid rgba(0,0,0,0.25); transform: translateY(-6px); }
  .qz-score { display: flex; align-items: center; gap: 16px; font-size: 22px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: rgba(0,0,0,0.5); }
  .qz-score span { margin-right: 10px; }
  .qz-score b { width: 40px; height: 40px; border: 3px solid #1A1A1A; border-radius: 8px; }
  .qz-score em { font-style: normal; color: #1A1A1A; margin-right: 18px; }

  /* Weather check-in: forecast card — big weather icon, forecast label, the check-in question. */
  .wx-wrap { position: absolute; left: 100px; right: 100px; top: 150px; bottom: 150px; }
  .wx { position: absolute; inset: 0; border-radius: 48px; padding: 64px 70px; display: flex; flex-direction: column; color: #FFFFFF;
        box-shadow: 0 30px 60px rgba(11,46,34,0.25); }
  .wx em { color: var(--wxem); }
  .wx-head { display: flex; justify-content: space-between; font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; opacity: .8; }
  .wx-icon { margin-top: 40px; }
  .wx-temp { margin-top: 16px; font-size: 26px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; opacity: .85; }
  .wx h2 { margin-top: auto; font-size: 78px; line-height: 1.1; text-wrap: balance; }
  .wx p { margin-top: 24px; font-size: 32px; line-height: 1.45; opacity: .85; }

  /* Road signs: red no-entry + green arrow sign, joined by a sign post. */
  .rs-wrap { position: absolute; left: 90px; right: 90px; top: 170px; bottom: 170px; background: #FFFFFF; border-radius: 40px; padding: 60px 64px;
             display: flex; flex-direction: column; justify-content: center; color: #0F1E4A; box-shadow: 0 30px 60px rgba(0,0,0,0.25); }
  .rs-wrap em { color: ${t.accentOnCard}; }
  .rs-head { position: absolute; top: 50px; left: 64px; font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: rgba(15,30,74,0.45); }
  .rs-row { display: flex; align-items: center; gap: 40px; }
  .rs-row small { font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: rgba(15,30,74,0.5); }
  .rs-row h3 { margin-top: 8px; font-family: Serif; font-weight: 400; font-size: 58px; line-height: 1.08; text-wrap: balance; }
  .rs-row:first-of-type h3 { color: rgba(15,30,74,0.5); text-decoration: line-through; text-decoration-color: #D93556; text-decoration-thickness: 4px; }
  .rs-sign { flex: none; width: 150px; height: 150px; display: flex; align-items: center; justify-content: center; }
  .rs-sign.stop { border-radius: 50%; background: #D93556; box-shadow: inset 0 0 0 8px #FFFFFF, 0 0 0 4px #D93556; }
  .rs-sign.stop i { width: 92px; height: 24px; background: #FFFFFF; border-radius: 4px; }
  .rs-sign.go { border-radius: 24px; background: #0B8A62; box-shadow: inset 0 0 0 8px #FFFFFF, 0 0 0 4px #0B8A62; }
  .rs-note { margin-top: 14px; font-size: 30px; line-height: 1.4; color: rgba(15,30,74,0.6); }
  .rs-post { width: 12px; height: 90px; margin: 14px 0 14px 69px; background: #B8BCC6; border-radius: 6px; }

  /* Fortune cookie: cookie above a white paper slip. */
  .fc-wrap { position: absolute; left: 80px; right: 80px; top: 100px; bottom: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .fc-cookie { filter: drop-shadow(0 20px 24px rgba(0,0,0,0.5)); }
  .fc-slip { margin-top: -40px; width: 860px; background: #FFFDF7; color: #1A1A1A; padding: 50px 60px 44px; border-radius: 4px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
  .fc-slip em { color: #B8441E; }
  .fc-head { display: flex; justify-content: space-between; font-size: 20px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: #D93556; }
  .fc-slip h2 { margin-top: 30px; font-size: 72px; line-height: 1.14; text-wrap: balance; }
  .fc-lucky { margin-top: 30px; font-family: 'Courier New', monospace; font-size: 24px; color: rgba(0,0,0,0.5); border-top: 2px dashed rgba(0,0,0,0.15); padding-top: 18px; }

  /* Newspaper clipping: newsprint, masthead, headline, two-column body, red stamp. */
  .nw-wrap { position: absolute; left: 100px; right: 100px; top: 150px; bottom: 150px; }
  .nw { position: absolute; inset: 0; background: #F4F0E6; color: #1A1A1A; padding: 50px 60px; display: flex; flex-direction: column;
        box-shadow: 0 30px 60px rgba(120,90,0,0.3);
        clip-path: polygon(0 1%, 8% 0, 20% 1.5%, 34% 0, 48% 1%, 62% 0, 76% 1.2%, 90% 0, 100% 1%, 99% 30%, 100% 60%, 99.2% 99%, 86% 100%, 70% 98.8%, 52% 100%, 36% 98.6%, 18% 100%, 0 99%, 0.8% 60%, 0 30%); }
  .nw em { color: #B3261E; }
  .nw-mast { text-align: center; font-family: Serif; font-size: 64px; border-bottom: 4px double #1A1A1A; padding-bottom: 10px; }
  .nw-meta { display: flex; justify-content: space-between; font-size: 20px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: rgba(0,0,0,0.55);
             border-bottom: 2px solid #1A1A1A; padding: 12px 0; }
  .nw-kicker { margin-top: auto; font-size: 26px; font-weight: 700; letter-spacing: 6px; text-transform: uppercase; color: #B3261E; }
  .nw h2 { margin-top: 10px; font-size: 80px; line-height: 1.04; text-wrap: balance; }
  .nw-cols { margin-top: 30px; margin-bottom: auto; column-count: 1; }
  .nw-cols p { font-family: Serif; font-size: 40px; line-height: 1.3; color: rgba(0,0,0,0.8); text-wrap: pretty; }
  .nw-cols b { font-family: Inter; font-weight: 700; font-size: 26px; letter-spacing: 2px; text-transform: uppercase; }
  .nw-stamp { position: absolute; right: 50px; bottom: 60px; transform: rotate(-14deg); border: 7px solid #D93556; color: #D93556; border-radius: 12px;
              padding: 6px 26px; font-weight: 800; font-size: 54px; letter-spacing: 8px; text-transform: uppercase; opacity: .85; }

  /* ---- k cards: shared layout ---- */
  .k-wrap { position: absolute; left: 100px; right: 100px; top: 140px; bottom: 140px; }
  .k { position: absolute; inset: 0; border-radius: 40px; background: ${t.card}; color: ${t.onCard}; padding: 64px 70px; display: flex; flex-direction: column;
       justify-content: center; box-shadow: 0 30px 60px rgba(0,0,0,0.22); }
  .k em { color: ${t.accentOnCard}; }
  .k-top { margin-bottom: 36px; }
  .k-label { font-size: 22px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .k h2 { margin-top: 18px; font-size: 82px; line-height: 1.1; text-wrap: balance; }
  .k-wrap.solo .k h2 { font-size: 92px; line-height: 1.08; }
  .k p { margin-top: 26px; font-size: 38px; line-height: 1.42; opacity: .82; text-wrap: pretty; }

  .k-rain .k { background: #F4F9FF; }
  .k-window { position: relative; height: 280px; border-radius: 18px; background: #8EC5FF;
              box-shadow: inset 0 0 0 12px #FFFFFF, inset 0 0 0 16px #CFE3FA; overflow: hidden; }
  .k-window::before, .k-window::after { content: ''; position: absolute; background: #FFFFFF; }
  .k-window::before { left: 50%; top: 0; bottom: 0; width: 12px; margin-left: -6px; } .k-window::after { top: 50%; left: 0; right: 0; height: 12px; margin-top: -6px; }
  .k-window i { position: absolute; width: 14px; height: 22px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: rgba(255,255,255,0.75); }

  .k-podium .k-top { display: flex; align-items: flex-end; height: 260px; }
  .k-pod { width: 230px; border-radius: 18px 18px 0 0; background: #8A2F14; display: flex; justify-content: center; padding-top: 14px;
           box-shadow: inset 0 10px 0 rgba(255,255,255,0.18); }
  .k-pod span { font-family: Serif; font-size: 72px; line-height: 1; color: #FFFFFF; }
  .k-xp { margin-top: 40px; display: flex; flex-direction: column; gap: 12px; font-size: 22px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: ${t.onCardMuted}; }
  .k-xp b { height: 18px; border-radius: 9px; background: rgba(0,0,0,0.08); overflow: hidden; } .k-xp i { display: block; height: 100%; background: ${t.accentOnCard}; border-radius: 9px; }

  .k-bubble h2 { font-size: 64px; }
  .k-opts { margin-top: 34px; display: flex; flex-direction: column; gap: 16px; }
  .k-opts div { display: flex; align-items: center; gap: 22px; }
  .k-opts b { flex: none; width: 54px; height: 54px; border-radius: 50%; border: 3px solid ${t.accentOnCard}; color: ${t.accentOnCard}; display: flex; align-items: center; justify-content: center; font-size: 24px; }
  .k-opts span { font-family: Serif; font-size: 36px; line-height: 1.2; }

  .k-napkin .k { background-color: #FFFFFF; background-image: radial-gradient(rgba(0,0,0,0.06) 2px, transparent 2.5px); background-size: 30px 30px;
                 border-radius: 6px; box-shadow: 0 30px 60px rgba(60,40,20,0.18), inset 0 0 0 22px #FFFFFF, inset 0 0 0 25px rgba(0,0,0,0.06); }
  .k-napkin h2 { font-family: Script; font-size: 92px; line-height: 1.12; color: #2A1A14; }
  .k-napkin h2 em { font-style: normal; }

  .k-chart { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
  .k-chart i { aspect-ratio: 1; border-radius: 14px; border: 3px solid rgba(0,0,0,0.12); display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 46px; color: #FFB020; }
  .k-chart i.on { background: #FFF6D6; border-color: #FFD93D; }

  .k-depth .k { background: #2B4A8A; color: #FFFFFF; padding-left: 150px; }
  .k-depth .k em { color: #FFE7A0; } .k-depth .k-label { color: rgba(255,255,255,0.6); } .k-depth .k p { opacity: .8; }
  .k-gauge { position: absolute; left: 60px; top: 70px; bottom: 70px; width: 14px; border-radius: 7px; background: #8EC5FF; margin: 0; }
  .k-depth .k-top { position: absolute; left: 0; top: 0; bottom: 0; margin: 0; width: 140px; }
  .k-gauge b { position: absolute; left: -14px; width: 42px; height: 42px; margin-top: -21px; border-radius: 50%; background: #FFE7A0; box-shadow: 0 0 0 8px rgba(255,231,160,0.25); }

  .k-clapper .k { background: #1A1A1A; color: #FFFFFF; } .k-clapper .k em { color: #FFD93D; } .k-clapper .k-label { color: rgba(255,255,255,0.55); }
  .k-clap { height: 90px; border-radius: 12px; background: repeating-linear-gradient(-45deg, #FFFFFF 0 40px, #1A1A1A 40px 80px); border: 6px solid #FFFFFF; transform: rotate(-4deg); transform-origin: left; }

  .k-lock .k { background: #3B74E6; color: #FFFFFF; align-items: center; text-align: center; border-radius: 64px; }
  .k-lock .k-label { display: none; }
  .k-time { font-family: Inter; font-weight: 300; font-size: 150px; line-height: 1; letter-spacing: -4px; }
  .k-lock h2 { background: rgba(255,255,255,0.92); color: #0F1E4A; border-radius: 34px; padding: 34px 40px; font-size: 52px; text-align: left; margin-top: 50px; }
  .k-lock h2 em { color: #1D5BD8; } .k-lock p { margin-top: 26px; opacity: .85; font-size: 30px; }

  .k-seeds .k { background: #FFFDF5; border-radius: 10px; border-top: 24px solid ${t.accentOnCard}; }
  .k-seedart { height: 270px; border-radius: 14px; background: #E3F8EC; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }

  .k-wheel .k-top { display: flex; justify-content: center; }

  .k-cassette .k { background: #FFF6E5; border: 22px solid #2A2A2E; border-radius: 34px; }
  .k-reels { margin-top: 40px; display: flex; align-items: center; justify-content: center; gap: 40px; background: #2A2A2E; border-radius: 20px; padding: 22px; }
  .k-reels i { width: 86px; height: 86px; border-radius: 50%; background: #FFFFFF; box-shadow: inset 0 0 0 18px #2A2A2E, inset 0 0 0 26px #FFFFFF; }
  .k-reels span { width: 170px; height: 46px; border-radius: 10px; background: #5A4632; }

  .k-hazard .k { border: 22px solid transparent; background: #FFFFFF padding-box, repeating-linear-gradient(45deg, #1A1A1A 0 22px, #FFD93D 22px 44px) border-box; }

  .k-advent .k { background: ${t.accentOnCard}; color: #FFFFFF; } .k-advent .k em { color: #FFE7A0; } .k-advent .k-label { color: rgba(255,255,255,0.7); }
  .k-door { position: relative; height: 230px; width: 260px; border-radius: 14px; background: #FFE7A0; perspective: 600px; }
  .k-door span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end; padding-right: 34px; font-family: Serif; font-size: 110px; color: ${t.accentOnCard}; }
  .k-door i { position: absolute; inset: 0; border-radius: 14px; background: #FFFFFF; border: 4px dashed ${t.accentOnCard}; width: 48%; transform-origin: left; transform: rotateY(-35deg); }

  .k-matches .k { padding-left: 150px; border-left: 40px solid #8A4B2A; background: #2C2C2E; color: #FFFFFF; }
  .k-matches .k em { color: #FFB020; } .k-matches .k-label { color: rgba(255,255,255,0.55); }
  .k-matches .k-top { position: absolute; left: 30px; top: 50%; margin: -95px 0 0; }

  .k-scale { margin-top: 44px; display: grid; grid-template-columns: repeat(10, 1fr); gap: 8px; }
  .k-scale i { font-style: normal; height: 64px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 24px;
               color: ${t.accentOnCard}; border: 3px solid rgba(46,91,255,0.3); }

  .k-capsule .k { background: #F6F2FF; }

  .k-comic .k { border: 8px solid #1A1A1A; border-radius: 18px; background: #FFFFFF;
                background-image: radial-gradient(rgba(0,0,0,0.12) 3px, transparent 3.5px); background-size: 22px 22px; }
  .k-comic .k-label { align-self: flex-start; background: #FFD93D; color: #1A1A1A; border: 5px solid #1A1A1A; padding: 10px 20px; transform: rotate(-2deg); }
  .k-comic h2 { position: relative; background: #FFFFFF; border: 6px solid #1A1A1A; border-radius: 40px; padding: 40px 46px; margin-top: 40px; font-size: 64px; }
  .k-comic h2::after { content: ''; position: absolute; left: 80px; bottom: -40px; border: 20px solid transparent; border-top: 22px solid #1A1A1A; }
  .k-comic p { margin-top: 56px; font-weight: 600; }

  .k-mission .k { background: #3D3870; box-shadow: 0 30px 60px rgba(0,0,0,0.4), inset 0 0 0 3px rgba(255,255,255,0.12); color: #FFFFFF; background-image: radial-gradient(rgba(255,255,255,0.5) 1.5px, transparent 2px); background-size: 60px 60px; }
  .k-mission .k em { color: #FFE7A0; } .k-mission .k-label { color: rgba(255,255,255,0.6); }

  .k-house .k { border-radius: 0 0 36px 36px; clip-path: polygon(50% 0, 100% 22%, 100% 100%, 0 100%, 0 22%); padding-top: 220px; background: #FFFFFF; }
  .k-house .k-label { color: ${t.accentOnCard}; }

  .k-bed .k-top { display: flex; justify-content: center; }
  .k-bed h2 { font-size: 70px; }

  .k-rosette .k { align-items: center; text-align: center; }

  .k-lplate { position: relative; width: 520px; height: 200px; border-radius: 22px; background: #FFFFFF; border: 8px solid #1A1A1A; display: flex; flex-direction: column;
             align-items: center; justify-content: center; box-shadow: 0 8px 0 rgba(0,0,0,0.12); }
  .k-lplate small { font-size: 22px; font-weight: 700; letter-spacing: 8px; text-transform: uppercase; color: ${t.accentOnCard}; }
  .k-lplate b { font-family: 'Courier New', monospace; font-weight: 700; font-size: 92px; letter-spacing: 6px; color: #1A1A1A; }
  .k-lplate i { position: absolute; top: 18px; width: 14px; height: 14px; border-radius: 50%; background: #9A9AA5; } .k-lplate i:nth-of-type(1) { left: 22px; } .k-lplate i:nth-of-type(2) { right: 22px; }

  .k-wave .k { background: #1F1B3A; color: #FFFFFF; } .k-wave .k em { color: #FF6F8E; } .k-wave .k-label { color: rgba(255,255,255,0.6); }
  .k-wave .k-top > div, .k-wave .k-top { }
  .k-wave .k-top div { height: 150px; display: flex; align-items: center; gap: 6px; }
  .k-wave .k-top div i { flex: 1; border-radius: 4px; background: rgba(255,255,255,0.25); } .k-wave .k-top div i.on { background: #FF6F8E; }

  .k-thermo .k { padding-left: 170px; } .k-thermo .k-top { position: absolute; left: 50px; top: 50%; margin: -110px 0 0; }

  .k-hanger .k { border-radius: 60px 60px 30px 30px; padding-top: 240px; }
  .k-hanger .k::before { content: ''; position: absolute; left: 50%; top: 60px; width: 150px; height: 150px; margin-left: -75px; border-radius: 50%; background: ${t.bg}; }
  .k-hanger .k::after { content: ''; position: absolute; left: 50%; top: 200px; width: 26px; height: 50px; margin-left: -13px; background: ${t.bg}; }
  .k-hanger .k-label { color: ${t.accentOnCard}; }

  .k-candle .k { background: #2C2C2E; color: #FFFFFF; align-items: center; text-align: center; }
  .k-candle .k em { color: #FFD60A; } .k-candle .k-label { color: rgba(255,255,255,0.55); }

  .k-boxing .k { border-top: 16px solid #D93556; border-bottom: 16px solid #D93556; box-shadow: 0 30px 60px rgba(0,0,0,0.3), inset 0 18px 0 #FFFFFF, inset 0 30px 0 #2E5BFF; }
  .k-round { font-family: Inter; font-weight: 800; font-size: 96px; letter-spacing: -2px; text-transform: uppercase; color: #D93556; }
  .k-boxing .k-label { display: none; }

  .k-contract .k { background: #FFFDF7; border-radius: 6px; border: 3px solid rgba(0,0,0,0.12); box-shadow: 0 30px 60px rgba(60,40,20,0.18); }
  .k-contract .k-label { font-family: Serif; font-style: italic; font-size: 40px; letter-spacing: 0; text-transform: none; color: ${t.accentOnCard}; }
  .k-sign { margin-top: 70px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px; }
  .k-sign i { display: block; border-bottom: 3px solid #1A1A1A; height: 40px; } .k-sign span { font-size: 20px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: rgba(0,0,0,0.45); }

  /* Versus card: A on white, B on the theme's soft tint, "or" badge centered on the seam. */
  .vs-wrap { position: absolute; left: 110px; right: 110px; top: 150px; bottom: 150px; }
  .vs-back { position: absolute; inset: 0; border-radius: 44px; background: ${t.back2}; transform: rotate(4deg) translate(20px, 12px); }
  .vs { position: absolute; inset: 0; border-radius: 44px; overflow: hidden; display: flex; flex-direction: column;
        color: ${t.onCard}; box-shadow: 0 30px 60px rgba(0,0,0,0.25); }
  .vs-half { flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
             text-align: center; padding: 0 80px; gap: 26px; }
  .vs-half.a { background: ${t.card}; }
  .vs-half.b { background: ${t.tint ?? t.card}; }
  .vs-half h2 { font-size: 80px; }
  .vs-half em { color: ${t.accentOnCard}; }
  .vs-meta { position: absolute; top: 48px; left: 0; right: 0; font-size: 22px; font-weight: 600; letter-spacing: 3px;
             text-transform: uppercase; color: ${t.onCardMuted}; }
  .vs-key { width: 60px; height: 60px; border-radius: 50%; border: 3px solid ${t.onCard}; display: flex; align-items: center;
            justify-content: center; font-size: 26px; font-weight: 600; }
  .vs-or { position: absolute; left: 50%; top: 50%; width: 132px; height: 132px; margin: -66px 0 0 -66px; border-radius: 50%;
           background: ${t.accentOnCard}; color: #FFFFFF; border: 10px solid ${t.card}; display: flex; align-items: center;
           justify-content: center; font-family: Serif; font-style: italic; font-size: 60px; padding-bottom: 8px; }

  /* Sticky note: butter note with tape, a ticked checkbox, folded corner and a peach note underneath. */
  .sticky-wrap { position: absolute; left: 120px; right: 120px; top: 205px; bottom: 205px; }
  /* The holder carries rotation + shadow; the note's corner is clipped away and the flap folds over it. */
  .note-holder { position: absolute; inset: 0; filter: drop-shadow(0 26px 30px rgba(80,20,0,0.3)); }
  .note { position: absolute; inset: 0; background: #FFE7A0; color: ${t.onCard}; border-radius: 6px;
          padding: 92px 72px 64px; display: flex; flex-direction: column;
          clip-path: polygon(0 0, 100% 0, 100% calc(100% - 90px), calc(100% - 90px) 100%, 0 100%); }
  .note::after { content: ''; position: absolute; right: 0; bottom: 0; width: 90px; height: 90px;
                 background: linear-gradient(135deg, #EFC766 50%, transparent 50%); }
  .note.under { background: #FFD9CC; transform: rotate(5deg) translate(26px, 12px); clip-path: none;
                filter: drop-shadow(0 18px 24px rgba(80,20,0,0.22)); }
  .note.under::after { display: none; }
  .note em { color: ${t.accentOnCard}; }
  .tape { position: absolute; top: -26px; left: 50%; width: 200px; height: 58px; margin-left: -100px;
          background: rgba(255,255,255,0.55); transform: rotate(-3deg); box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
  .note-head { display: flex; justify-content: space-between; font-size: 22px; font-weight: 600; letter-spacing: 3px;
               text-transform: uppercase; color: ${t.onCardMuted}; }
  .todo { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .box { position: relative; display: block; width: 76px; height: 76px; border: 5px solid ${t.onCard}; border-radius: 14px; margin-bottom: 44px; }
  .box svg { position: absolute; left: 4px; top: -22px; color: ${t.accentOnCard}; }
  .todo .tip { margin: 0; }
  .todo .tip h2 { font-size: 80px; }
  .note-foot { display: flex; justify-content: flex-end; padding-right: 70px; }
  .hand { font-family: Script; font-size: 54px; color: ${t.accentOnCard}; transform: rotate(-4deg); }

  /* Ticket card: boarding pass with a route header, perforation notches and a barcode. */
  /* The notches are real cut-outs (mask), so the shadow lives on the wrapper as a drop-shadow. */
  .ticket-wrap { position: absolute; left: 110px; right: 110px; top: 150px; bottom: 150px;
                 filter: drop-shadow(0 26px 40px rgba(0,0,0,0.25)); }
  .ticket { position: absolute; inset: 0; background: ${t.card}; color: ${t.onCard}; border-radius: 36px;
            display: flex; flex-direction: column;
            -webkit-mask: radial-gradient(circle 30px at 0 300px, #0000 97%, #000 100%),
                          radial-gradient(circle 30px at 100% 300px, #0000 97%, #000 100%);
            -webkit-mask-composite: source-in; mask-composite: intersect; }
  .ticket em { color: ${t.accentOnCard}; }
  .t-top { height: 300px; padding: 56px 64px 0; }
  .t-row { display: flex; justify-content: space-between; font-size: 22px; font-weight: 600; letter-spacing: 3px;
           text-transform: uppercase; color: ${t.onCardMuted}; }
  .t-route { display: flex; align-items: center; justify-content: space-between; margin-top: 36px; }
  .t-route b { display: block; font-family: Serif; font-weight: 400; font-size: 96px; line-height: 1; }
  .t-route small { display: block; margin-top: 10px; font-size: 24px; font-weight: 500; color: ${t.onCardMuted}; }
  .t-route .right { text-align: right; }
  .t-path { flex: 1; display: flex; align-items: center; gap: 14px; margin: 0 28px 34px; color: ${t.accentOnCard}; }
  .t-path i { flex: 1; border-top: 3px dotted ${t.onCardMuted}; }
  .t-perf { margin: -1.5px 52px 0; border-top: 3px dashed ${t.onCardMuted}; }
  .t-body { flex: 1; display: flex; padding: 0 64px; }
  .t-body .tip h2 { font-size: 76px; }
  .t-foot { display: flex; justify-content: space-between; align-items: center; padding: 0 64px 56px; }
  .seat { text-align: right; font-family: Serif; font-size: 36px; }
  .seat small { display: block; font-family: Inter; font-size: 20px; font-weight: 600; letter-spacing: 3px;
                text-transform: uppercase; color: ${t.onCardMuted}; margin-bottom: 6px; }
  .barcode { width: 300px; height: 56px; opacity: .85;
             background: repeating-linear-gradient(90deg, ${t.onCard} 0 3px, transparent 3px 7px, ${t.onCard} 7px 8px, transparent 8px 13px, ${t.onCard} 13px 17px, transparent 17px 20px); }
  </style></head><body>
  ${slideBody(slide, qTotal, post, t)}
  </body></html>`;
}

function screenshot(htmlPath, out, w, h) {
  execFileSync(chrome, [
    // The compositor flags make Chrome finish painting the whole frame before capture; without them a
    // slide occasionally comes out with an unpainted white block.
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    '--run-all-compositor-stages-before-draw', '--disable-features=PaintHolding', '--disable-gpu-compositing',
    `--window-size=${w},${h}`, '--virtual-time-budget=2500', `--screenshot=${out}`, url(htmlPath),
  ], { stdio: 'ignore' });
}

function contactSheet(dir, count, tmp) {
  const cols = 4, w = 270, h = 338, gap = 24;
  const rows = Math.ceil(count / cols);
  const sw = cols * w + (cols + 1) * gap, sh = rows * h + (rows + 1) * gap;
  const imgs = Array.from({ length: count }, (_, i) =>
    `<img src="${url(join(dir, 'slides', `${pad(i + 1)}.png`))}"/>`).join('');
  const p = join(tmp, 'sheet.html');
  writeFileSync(p, `<!doctype html><style>*{margin:0}body{background:#E9E4DE;width:${sw}px;height:${sh}px;display:grid;
    grid-template-columns:repeat(${cols},${w}px);gap:${gap}px;padding:${gap}px;box-sizing:border-box}
    img{width:${w}px;height:${h}px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.12)}</style>${imgs}`);
  screenshot(p, join(dir, 'preview.png'), sw, sh);
}

// Posts live in slideshow/<year>/<MM - month>/<n> - <day> (or <day> - <date>/<day>.<k>); find one by its number.
function findPost(id) {
  const walk = (d) => readdirSync(d).flatMap((name) => {
    const p = join(d, name);
    if (!statSync(p).isDirectory()) return [];
    // Single-post days: '<n> - <date>' (e.g. '8 - 26th'). Multi-post days: '<day> - <date>/<day>.<k>'
    // (e.g. '1 - 19th/1.2'). Month folders ('10 - october') never match either pattern.
    const n = String(id).replace(/[.]/g, '[.]');
    return new RegExp(`^(${n} - [0-9]+(st|nd|rd|th)|${n})$`).test(name) && existsSync(join(p, 'post.json')) ? [p] : walk(p);
  });
  const [dir] = walk(slideshowDir);
  if (!dir) throw new Error(`No folder for post ${id} under ${slideshowDir}`);
  return dir;
}

function renderPost(id) {
  const dir = findPost(id);
  const post = JSON.parse(readFileSync(join(dir, 'post.json'), 'utf8'));
  const tmp = join(dir, '.tmp');
  const outDir = join(dir, 'slides');
  mkdirSync(tmp, { recursive: true });
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  post.slides.forEach((slide, i) => {
    const p = join(tmp, `${i + 1}.html`);
    writeFileSync(p, html(slide, post));
    screenshot(p, join(outDir, `${pad(i + 1)}.png`), W, H);
  });
  contactSheet(dir, post.slides.length, tmp);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`  ✓ ${post.slides.length} slides → ${outDir}`);
}

const ids = process.argv.slice(2);
if (!ids.length) throw new Error('Pass one or more post numbers, e.g. `node render.mjs 1`');
for (const id of ids) {
  console.log(`Rendering slideshow ${id}`);
  renderPost(id);
}
