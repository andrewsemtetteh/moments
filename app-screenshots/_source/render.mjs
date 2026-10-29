// Store screenshots (RGB PNG) into ../screenshots/<store>: App Store, iPhone 6.9" (1290 x 2796);
// Google Play, 1080 x 1920 with Android's own chrome, plus Play's feature graphic and 512 icon.
// Every phone screen is drawn from the app's own code: the Violet theme (the default), the real
// component sizes and copy, the real Ionicons glyphs (the font the app uses), the sticker flame's
// paths, the Handpicked area art from src/, and the widget colours from targets/widget.
// A real capture in ../captures/<store> (01-home.png ...) replaces the drawn screen in that phone.
// Run: node app-screenshots/_source/render.mjs [appstore|playstore] [prefix]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { AREA_ART } from '../../src/components/play/area-art.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const repo = join(root, '..');
const tmpDir = join(here, '.tmp');
// One layout per store. App Store: iPhone 6.9" (1290 x 2796). Google Play: 1080 x 1920 (9:16, the
// size Play recommends for phone screenshots), an Android phone and Android's own system chrome.
const PLATFORMS = {
  appstore: {
    W: 1290, H: 2796, SW: 393, SH: 852, SCALE: 2.35, BEZEL: 16, RADIUS: 56, font: 'Inter',
    head: 150, sub: 52, padTop: 130, subGap: 34, phoneGap: 60, k: 1, android: false,
  },
  playstore: {
    W: 1080, H: 1920, SW: 412, SH: 892, SCALE: 1.6, BEZEL: 12, RADIUS: 34, font: 'Roboto',
    head: 100, sub: 38, padTop: 80, subGap: 22, phoneGap: 36, k: 0.66, android: true,
  },
};
let P = PLATFORMS.appstore;
let { W, H, SW, SH, SCALE, BEZEL } = P;
function usePlatform(name) {
  P = PLATFORMS[name];
  ({ W, H, SW, SH, SCALE, BEZEL } = P);
}

const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));
if (!chrome) throw new Error('No Chrome or Edge found for rendering');

const file = (p) => pathToFileURL(p).href;
const photo = (name) => file(join(here, 'photos', name));
const APP_ICON = file(join(repo, 'assets/branding/moments-e8/png/app-icon-1024.png'));
const VI = join(repo, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons');
const ION_FONT = file(join(VI, 'Fonts/Ionicons.ttf'));
const ION = JSON.parse(readFileSync(join(VI, 'glyphmaps/Ionicons.json'), 'utf8'));

/** An Ionicons glyph, exactly as the app's <Icon> draws it. */
function ion(name, size, color, extra = '') {
  const code = ION[name];
  if (code == null) throw new Error(`No Ionicons glyph: ${name}`);
  return `<span style="font-family:Ionicons;font-size:${size}px;line-height:${size}px;width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;color:${color};flex:none;${extra}">&#x${code.toString(16)};</span>`;
}

// ---- The Violet theme (src/constants/design-system.ts) ----
const C = {
  bg: '#FFFFFF',
  surface: '#F0ECFF',
  surfaceElevated: '#EDE9F9',
  text: '#1A1A1A',
  text2: 'rgba(26,26,26,0.70)',
  text3: 'rgba(26,26,26,0.66)',
  accent: '#5E4CCB',
  accentSoft: 'rgba(140,124,240,0.16)',
  hero: '#5E4CCB',
  border: '#E6E2F5',
  borderStrong: '#D2CCEB',
  success: '#18783F',
  warning: '#A35F00',
  error: '#C8372F',
  butter: '#FFE680',
  blush: '#F1A3B6',
  sky: '#B8D9FF',
  bubbleSelf: '#5E4CCB',
  bubblePartner: '#F1EEFB',
};

// ---- The sticker flame (src/components/home/StickerFlame.tsx) ----
let flameId = 0;
function stickerFlame(size, { face = false } = {}) {
  const id = `fl${flameId++}`;
  const small = size < 48;
  const h = (size * 140) / 120;
  return `<svg width="${size}" height="${h}" viewBox="0 0 120 140" aria-hidden="true" style="flex:none">
    <defs>
      <linearGradient id="${id}o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB23E"/><stop offset="0.45" stop-color="#FF7A1A"/><stop offset="1" stop-color="#F0501A"/></linearGradient>
      <linearGradient id="${id}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF0A8"/><stop offset="1" stop-color="#FFC83D"/></linearGradient>
    </defs>
    <path d="M60 4 C66 26 90 40 99 66 C108 96 92 134 60 135 C28 134 11 104 19 76 C23 61 31 52 38 46 C37 60 42 70 50 73 C45 50 49 27 60 4 Z" fill="url(#${id}o)" stroke="#000" stroke-width="${small ? 9 : 4}" stroke-linejoin="round"/>
    ${small ? '' : '<path d="M28.5 108 C25 98 25.5 88 29.5 80" fill="none" stroke="#FFD49A" stroke-width="4.5" stroke-linecap="round"/>'}
    <path d="M62 56 C70 70 84 81 84 101 C84 118 74 128 60 128 C46 128 36 118 36 104 C36 92 42 84 50 78 C50 88 54 94 60 96 C56 82 56 69 62 56 Z" fill="url(#${id}i)" stroke="#000" stroke-width="${small ? 7 : 3.5}" stroke-linejoin="round"/>
    ${face ? `<path d="M53.5 111 Q60 117 66.5 111" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="45.5" cy="110" rx="3.8" ry="2.3" fill="#FF8FA3"/><ellipse cx="74.5" cy="110" rx="3.8" ry="2.3" fill="#FF8FA3"/>
      <ellipse cx="52.5" cy="101" rx="3.6" ry="4.6" fill="#000"/><ellipse cx="67.5" cy="101" rx="3.6" ry="4.6" fill="#000"/>
      <circle cx="53.8" cy="99.2" r="1.25" fill="#fff"/><circle cx="68.8" cy="99.2" r="1.25" fill="#fff"/>` : ''}
  </svg>`;
}

// ---- The logo mark (assets/branding/moments-e8/icon-square.svg), tile removed ----
const MARK = readFileSync(join(repo, 'assets/branding/moments-e8/icon-square.svg'), 'utf8')
  .replace(/<title>[^<]*<\/title>/, '')
  .replace(/<rect width="100" height="100" fill="#1F1B3A"\/>/, '');
const mark = (size, color) =>
  MARK.replace('width="1024" height="1024"', `width="${size}" height="${size}"`).split('#FF4D6D').join(color);

// ---- The couple: Sam (you) and Maya, both from one photo (moment-sunset.jpg, 1600 x 2000) ----
const FACES = {
  maya: { src: 'moment-sunset.jpg', cx: 850, cy: 680, w: 360 },
  sam: { src: 'moment-sunset.jpg', cx: 540, cy: 590, w: 360 },
};
function face(who, size, ring = '') {
  const f = FACES[who];
  const imgW = 1600 * ((size * 0.95) / f.w);
  const k = imgW / 1600;
  return `<div style="flex:none;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;position:relative;box-sizing:border-box;${ring}">
    <img src="${photo(f.src)}" style="position:absolute;width:${imgW}px;left:${size / 2 - f.cx * k}px;top:${size / 2 - f.cy * k}px">
  </div>`;
}

// ---- System chrome (iOS, or Android on the Play Store set) ----
function statusBar(ink = '#000') {
  if (P.android) {
    return `<div style="position:absolute;left:0;right:0;top:0;height:40px;display:flex;align-items:center;justify-content:space-between;padding:4px 22px 0;box-sizing:border-box;z-index:5;color:${ink};font-family:Roboto,sans-serif">
      <span style="font-size:14px;font-weight:500">9:41</span>
      <span style="display:flex;align-items:center;gap:5px">
        <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 0.5 3.4A11 11 0 0 1 15.5 3.4z" fill="${ink}"/></svg>
        <svg width="13" height="13" viewBox="0 0 13 13"><path d="M12.5 0.5v12H0.5z" fill="${ink}"/></svg>
        <svg width="8" height="14" viewBox="0 0 8 14"><rect x="2.5" y="0" width="3" height="1.6" rx="0.5" fill="${ink}"/><rect x="0.5" y="1.4" width="7" height="12.1" rx="1.4" fill="${ink}"/></svg>
      </span>
    </div>
    <div style="position:absolute;left:${SW / 2 - 7}px;top:12px;width:14px;height:14px;border-radius:7px;background:#000;z-index:6"></div>`;
  }
  return `<div style="position:absolute;left:0;right:0;top:0;height:54px;display:flex;align-items:center;justify-content:space-between;padding:6px 36px 0 52px;box-sizing:border-box;z-index:5;color:${ink}">
    <span style="font-size:17px;font-weight:600;letter-spacing:-0.2px">9:41</span>
    <span style="display:flex;align-items:center;gap:6px">
      <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx="1" fill="${ink}"/><rect x="5" y="5.5" width="3.2" height="6.5" rx="1" fill="${ink}"/><rect x="10" y="3" width="3.2" height="9" rx="1" fill="${ink}"/><rect x="15" y="0" width="3.2" height="12" rx="1" fill="${ink}"/></svg>
      <svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.6 10.6 0 0 0 8.5.4 10.6 10.6 0 0 0 1 3.4l1.3 1.3a8.8 8.8 0 0 1 6.2-2.5z" fill="${ink}"/><path d="M8.5 5.6c1.5 0 2.8.6 3.8 1.5l1.3-1.3a7.2 7.2 0 0 0-10.2 0l1.3 1.3c1-.9 2.3-1.5 3.8-1.5z" fill="${ink}"/><circle cx="8.5" cy="10" r="1.8" fill="${ink}"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke="${ink}" stroke-opacity="0.4"/><rect x="2" y="2" width="20" height="9" rx="2.5" fill="${ink}"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="${ink}" fill-opacity="0.4"/></svg>
    </span>
  </div>
  <div style="position:absolute;left:${(SW - 126) / 2}px;top:11px;width:126px;height:37px;border-radius:19px;background:#000;z-index:6"></div>`;
}
function homeIndicator(ink = '#000') {
  // Android's gesture bar is shorter and thinner than the iPhone home indicator.
  if (P.android) {
    return `<div style="position:absolute;left:${(SW - 108) / 2}px;bottom:8px;width:108px;height:4px;border-radius:2px;background:${ink};opacity:0.85;z-index:6"></div>`;
  }
  return `<div style="position:absolute;left:${(SW - 140) / 2}px;bottom:8px;width:140px;height:5px;border-radius:3px;background:${ink};z-index:6"></div>`;
}

// ---- The floating tab bar (src/components/layout/AppTabBar.tsx) ----
function tabBar(active) {
  const barW = SW - 32;
  const r = 32;
  const cr = 36; // FAB 56 / 2 + 8 gap
  const cx = barW / 2;
  const path = `M ${r} 0 H ${cx - cr} A ${cr} ${cr} 0 0 0 ${cx + cr} 0 H ${barW - r} A ${r} ${r} 0 0 1 ${barW} ${r} V ${64 - r} A ${r} ${r} 0 0 1 ${barW - r} 64 H ${r} A ${r} ${r} 0 0 1 0 ${64 - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  const tab = (key, label, icon) => {
    const on = active === key;
    const color = on ? C.accent : C.text2;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">${ion(on ? icon : `${icon}-outline`, 28, color)}<span style="font-size:11px;font-weight:${on ? 900 : 700};color:${color}">${label}</span></div>`;
  };
  return `<div style="position:absolute;left:16px;bottom:24px;width:${barW}px;height:64px;z-index:4;filter:drop-shadow(0 4px 16px rgba(0,0,0,0.10))">
    <svg width="${barW}" height="64" style="position:absolute;left:0;top:0"><path d="${path}" fill="#FFFFFF" stroke="${C.borderStrong}" stroke-width="1"/></svg>
    <div style="position:relative;display:flex;align-items:center;height:64px;padding:0 14px">
      ${tab('home', 'Home', 'home')}
      ${tab('play', 'Play', 'people')}
      <div style="width:${cr * 2}px;height:64px;display:flex;justify-content:center">
        <div style="margin-top:-28px;width:56px;height:56px;border-radius:28px;background:${C.accent};display:flex;align-items:center;justify-content:center">${ion('add', 28, '#FFFFFF')}</div>
      </div>
      ${tab('chat', 'Chat', 'chatbubbles')}
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="width:32px;height:32px;margin:-2px 0;border-radius:16px;border:2px solid transparent;box-sizing:border-box;display:flex;align-items:center;justify-content:center">${face('sam', 28)}</div>
        <span style="font-size:11px;font-weight:700;color:${C.text2}">You</span>
      </div>
    </div>
  </div>`;
}

// ---- The app's header (src/components/layout/AppHeader.tsx): calendar · distance and their time · bell ----
function appHeader(onBand) {
  const ink = onBand ? '#FFFFFF' : C.text;
  const bg = onBand ? C.hero : '#FFFFFF';
  return `<div style="display:flex;align-items:center;padding:6px 14px 8px;background:${bg}">
    <div style="width:56px;display:flex"><div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${ion('calendar-outline', 28, ink)}</div></div>
    <div style="flex:1;display:flex;justify-content:center;align-items:center;font-size:17px;font-weight:700;letter-spacing:-0.2px;color:${ink}">2,140 km apart · 9:41</div>
    <div style="width:56px;display:flex;justify-content:flex-end;padding-right:2px">
      <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center">${ion('notifications-outline', 28, ink)}
        <span style="position:absolute;top:2px;right:2px;min-width:18px;height:18px;border-radius:9px;border:2px solid ${bg};box-sizing:border-box;background:${C.error};color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px">2</span></div>
    </div>
  </div>`;
}
const homeSection = (t) => `<div style="font-size:20px;font-weight:900;letter-spacing:-0.4px;color:${C.text}">${t}</div>`;

// ---- Home cards ----
function weekPanel() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return `<div style="margin-top:14px;border-radius:22px;padding:12px 10px;background:#FFFFFF;display:flex;justify-content:space-between">
    ${days
      .map((d, i) => {
        const done = i < 5;
        const today = i === 5;
        const circle = done
          ? `<div style="width:30px;height:30px;border-radius:15px;background:#FFE7A0;border:2px solid #000;box-sizing:border-box;display:flex;align-items:center;justify-content:center">${stickerFlame(16)}</div>`
          : today
            ? `<div style="width:30px;height:30px;border-radius:15px;border:2px solid #1A1A1A;box-sizing:border-box;display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:4px;background:#1A1A1A"></div></div>`
            : `<div style="width:30px;height:30px;border-radius:15px;border:2px dashed rgba(26,26,26,0.35);box-sizing:border-box"></div>`;
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="font-size:11px;font-weight:800;color:#1A1A1A;opacity:${today ? 1 : 0.75}">${d}</span>${circle}</div>`;
      })
      .join('')}
  </div>`;
}
function welcomeCard() {
  return `<div style="background:${C.hero};border-radius:0 0 32px 32px;padding:8px 24px 24px;display:flex;flex-direction:column;gap:6px;color:#fff">
    <span style="font-size:14px;font-weight:700;opacity:0.88">Good evening, Sam</span>
    <span style="font-size:30px;font-weight:900;letter-spacing:-0.7px;line-height:35px">Sam &amp; Maya</span>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">
      <div style="display:flex;align-items:center">
        <div style="border:3px solid #fff;border-radius:25px">${face('sam', 38)}</div>
        <div style="border:3px solid #fff;border-radius:25px;margin-left:-12px;position:relative">${face('maya', 38)}
          <span style="position:absolute;right:-10px;bottom:-6px;height:18px;border-radius:9px;border:1.5px solid #000;background:#fff;display:flex;align-items:center;gap:1px;padding:0 3px 0 5px;box-sizing:border-box;font-size:11px;font-weight:900;color:#1A1A1A">48${stickerFlame(11)}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:2px"><span style="font-size:44px;font-weight:900;letter-spacing:-1.5px;line-height:48px">48</span>${stickerFlame(40, { face: true })}</div>
    </div>
    ${weekPanel()}
  </div>`;
}
function momentCard(h = 420) {
  return `<div style="background:${C.surface};border:1px solid ${C.border};border-radius:28px;padding:12px;display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;align-items:center;gap:10px;padding:2px 4px 0">${face('maya', 34)}
      <div style="flex:1;display:flex;flex-direction:column;gap:1px"><span style="font-size:15px;font-weight:800;color:${C.text}">Maya</span><span style="font-size:12px;font-weight:600;color:${C.text3}">12m ago</span></div>
      <div style="width:44px;height:44px;margin-right:-6px;display:flex;align-items:center;justify-content:center">${ion('albums-outline', 26, C.text)}</div>
    </div>
    <div style="display:flex;gap:4px;padding:0 4px;margin-bottom:2px"><div style="flex:1;height:4px;border-radius:2px;background:${C.text}"></div><div style="flex:1;height:4px;border-radius:2px;background:${C.text};opacity:0.22"></div><div style="flex:1;height:4px;border-radius:2px;background:${C.text};opacity:0.22"></div></div>
    <div style="height:${h}px;border-radius:22px;overflow:hidden;border:1px solid ${C.border}">
      <img src="${photo('moment-sunset.jpg')}" style="width:100%;height:100%;object-fit:cover;object-position:55% 35%;display:block">
    </div>
  </div>`;
}
function moodCard() {
  const bubble = (name, emoji, label, ring) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px">
    <div style="width:60px;height:60px;border-radius:30px;background:#fff;border:3px solid ${ring};box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:30px" class="emoji">${emoji}</div>
    <span style="font-size:15px;font-weight:700;color:${C.text}">${name}</span><span style="font-size:13px;color:${C.text2}">${label}</span></div>`;
  const chip = (emoji, label, on) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:14px;background:${on ? '#fff' : 'rgba(255,255,255,0.62)'};border:${on ? `2px solid ${C.text}` : `1px solid ${C.border}`};box-sizing:border-box">
    <span style="font-size:20px" class="emoji">${emoji}</span><span style="font-size:10px;margin-top:2px;font-weight:${on ? 900 : 600};color:${on ? C.text : C.text2}">${label}</span></div>`;
  return `<div style="background:${C.blush};border:1px solid ${C.border};border-radius:22px;padding:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><span style="font-size:14px;font-weight:800;color:${C.text2}">How we’re feeling</span>${ion('time-outline', 22, C.text)}</div>
    <div style="display:flex;align-items:center">${bubble('Me', '🥰', 'Loved', '#FF8FAB')}<div style="width:1px;height:56px;margin:0 12px;background:${C.border}"></div>${bubble('Maya', '😊', 'Happy · 2h ago', '#FFC75F')}</div>
    <div style="display:flex;gap:6px;margin-top:18px">${chip('🥰', 'Loved', true)}${chip('😊', 'Happy', false)}${chip('🤩', 'Excited', false)}${chip('😌', 'Calm', false)}${chip('😴', 'Tired', false)}</div>
  </div>`;
}
function questionCard() {
  return `<div style="background:${C.butter};border:1px solid ${C.border};border-radius:22px;padding:16px;display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:14px;font-weight:800;color:${C.text2}">Today’s question</span>${ion('time-outline', 22, C.text)}</div>
    <span style="font-size:19px;font-weight:800;line-height:25px;letter-spacing:-0.3px;color:${C.text}">What’s one small thing I did this week that made you feel loved?</span>
    <span style="font-size:13px;font-weight:600;line-height:18px;color:${C.text2}">Maya answered. Answer to see theirs.</span>
    <div style="height:50px;border-radius:16px;background:${C.accent};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff">Answer</div>
  </div>`;
}

// ---- Moments pieces (MomentHistoryModal, MomentAlbums, MomentTile) ----
/** A page header: back on the left, the title centred, an icon on the right. */
function pageHeader(title, rightIcon) {
  return `<div style="display:flex;align-items:center;padding:6px 10px 12px">
    <div style="flex:1;display:flex"><div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${ion('chevron-back', 28, C.text)}</div></div>
    <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:${C.text}">${title}</span>
    <div style="flex:1;display:flex;justify-content:flex-end"><div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${ion(rightIcon, 28, C.text)}</div></div>
  </div>`;
}
/** An album as a folder: tinted back with a tab, three photos fanned out of it, the front flap. */
function albumFolder(name, icon, count, photos) {
  const tint = 'rgba(94,76,203,0.28)';
  const fan = [
    { left: 10, rotate: -9, top: 10, z: 1 },
    { left: 34, rotate: 0, top: 2, z: 3 },
    { left: 58, rotate: 9, top: 10, z: 2 },
  ];
  return `<div style="flex:none;width:132px">
    <div style="position:relative;width:132px;height:112px;margin-bottom:10px">
      <div style="position:absolute;top:6px;left:0;width:50px;height:22px;border-radius:10px 10px 0 0;background:${tint};border:1px solid ${C.border};box-sizing:border-box"></div>
      <div style="position:absolute;top:18px;left:0;right:0;bottom:0;border-radius:4px 16px 16px 16px;background:${tint};border:1px solid ${C.border};box-sizing:border-box"></div>
      ${photos
        .map((p, i) => `<div style="position:absolute;left:${fan[i].left}px;top:${fan[i].top}px;z-index:${fan[i].z};width:64px;height:64px;border-radius:12px;border:2.5px solid #fff;overflow:hidden;background:#fff;transform:rotate(${fan[i].rotate}deg);box-sizing:border-box"><img src="${photo(p)}" style="width:100%;height:100%;object-fit:cover"></div>`)
        .join('')}
      <div style="position:absolute;left:0;right:0;bottom:0;height:58px;z-index:5;border-radius:16px;background:${C.accent};display:flex;align-items:flex-end;justify-content:space-between;padding:0 12px 10px;box-sizing:border-box">
        ${ion(icon, 18, '#fff')}<span style="font-size:18px;font-weight:900;letter-spacing:-0.4px;color:#fff">${count}</span></div>
    </div>
    <span style="font-size:15px;font-weight:700;color:${C.text}">${name}</span>
  </div>`;
}
/** A month of moments: its heading and count, then portrait tiles three across. */
function monthGrid(label, count, photos) {
  const tileW = (SW - 28 - 12) / 3;
  const tileH = Math.round(tileW * (4 / 3));
  const times = ['6:48 PM', '9:12 PM', '1:05 PM', '8:30 PM', '11:20 AM', '7:41 PM', '5:02 PM', '10:15 AM', '3:33 PM'];
  const tile = (p, i) => `<div style="position:relative;width:${tileW}px;height:${tileH}px;border-radius:16px;overflow:hidden">
    <img src="${photo(p)}" style="width:100%;height:100%;object-fit:cover">
    <div style="position:absolute;left:0;right:0;bottom:0;height:44px;padding:0 7px 7px;box-sizing:border-box;display:flex;align-items:flex-end;gap:6px;background:linear-gradient(transparent,rgba(0,0,0,0.55))">
      <div style="border-radius:11px;border:1.5px solid rgba(255,255,255,0.9)">${face(i % 2 ? 'sam' : 'maya', 18)}</div>
      <span style="font-size:11px;font-weight:700;color:#fff;margin-bottom:2px">${times[i % times.length]}</span></div>
    ${i === 0 || i === 4 ? `<div style="position:absolute;top:6px;right:6px;height:26px;min-width:26px;padding:0 5px;box-sizing:border-box;border-radius:13px;background:rgba(255,255,255,0.92);display:flex;align-items:center;justify-content:center;font-size:14px" class="emoji">${i === 0 ? '❤️' : '😍'}</div>` : ''}
  </div>`;
  return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0 12px"><span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:${C.text}">${label}</span>
      <span style="height:22px;padding:0 9px;border-radius:11px;background:${C.surface};border:1px solid ${C.border};box-sizing:border-box;display:flex;align-items:center;font-size:12px;font-weight:800;color:${C.text2}">${count}</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,${tileW}px);gap:6px">${photos.map(tile).join('')}</div>`;
}
/** The floating pill button at the foot of Our moments and an album. */
function floatingButton(icon, label) {
  return `<div style="position:absolute;left:0;right:0;bottom:50px;display:flex;justify-content:center;z-index:4">
    <div style="display:flex;align-items:center;gap:10px;padding:15px 24px;border-radius:999px;background:${C.accent};border:1px solid ${C.border};box-shadow:0 8px 20px rgba(94,76,203,0.35)">${ion(icon, 20, '#fff')}<span style="font-size:16px;font-weight:800;color:#fff">${label}</span></div>
  </div>`;
}
/** Together's header and its Plan / Memories switch. */
function togetherHeader(tab) {
  const seg = (label, on) => `<div style="flex:1;height:36px;border-radius:999px;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;${on ? `background:${C.accent};color:#fff` : `color:${C.text2}`}">${label}</div>`;
  return `<div style="display:flex;align-items:center;gap:8px;padding:6px 20px 10px">
      <div style="width:44px;height:44px;margin-left:-10px"></div>
      <div style="flex:1;text-align:center;font-size:24px;font-weight:900;letter-spacing:-0.6px;color:${C.text}">Together</div>
      <div style="width:44px;height:44px;margin-right:-10px;display:flex;align-items:center;justify-content:center">${ion('chevron-forward', 28, C.text)}</div>
    </div>
    <div style="display:flex;margin:0 16px 14px;padding:4px;border-radius:999px;background:${C.surface};border:1px solid ${C.border}">${seg('Plan', tab === 'plan')}${seg('Memories', tab === 'memories')}</div>`;
}

// ---- Play's area palettes (src/components/play/illustration-palette.ts) ----
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => {
    const c = (n >> s) & 255;
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
const palette = (t) => ({ bg: t.wash, a: t.accent, d: shade(t.accent, -0.55), l: shade(t.accent, 0.6), w: '#FFFFFF', y: '#FFC857', k: '#FF7A9A' });

// ---- The screens (393 x 852 points) ----
const SCREENS = {
  home: () => `<div style="position:absolute;inset:0;background:#fff"></div>
    <div style="position:absolute;left:0;right:0;top:0;height:200px;background:${C.hero}"></div>
    ${statusBar('#FFFFFF')}
    <div style="position:absolute;left:0;right:0;top:54px;display:flex;flex-direction:column">
      ${appHeader(true)}${welcomeCard()}
      <div style="padding:24px 16px 0;display:flex;flex-direction:column;gap:12px">${homeSection('Today')}${questionCard()}</div>
    </div>
    ${tabBar('home')}${homeIndicator()}`,

  moments: () => `<div style="position:absolute;inset:0;background:#fff"></div>
    ${statusBar()}
    <div style="position:absolute;left:0;right:0;top:54px;display:flex;flex-direction:column">
      ${appHeader(false)}
      <div style="padding:6px 16px 0;display:flex;flex-direction:column;gap:24px">${momentCard(440)}<div style="display:flex;flex-direction:column;gap:12px">${homeSection('Today')}${moodCard()}</div></div>
    </div>
    ${tabBar('home')}${homeIndicator()}`,

  chat: () => {
    const partner = (t, time) => `<div style="align-self:flex-start;max-width:78%;background:${C.bubblePartner};border:0.5px solid ${C.border};border-radius:12px 12px 12px 2px;padding:7px 10px 6px;color:${C.text}"><span style="font-size:16px;line-height:21px">${t}</span><span style="float:right;margin:6px 0 0 8px;font-size:11px;color:${C.text3}">${time}</span></div>`;
    const self = (t, time) => `<div style="align-self:flex-end;max-width:78%;background:${C.bubbleSelf};border-radius:12px 12px 2px 12px;padding:7px 10px 6px;color:#fff"><span style="font-size:16px;line-height:21px">${t}</span><span style="float:right;margin:6px 0 0 8px;display:inline-flex;align-items:center;gap:3px;font-size:11px;color:rgba(255,255,255,0.6)">${time}${ion('checkmark-done', 14, '#8C7CF0')}</span></div>`;
    return `<div style="position:absolute;inset:0;background:#fff"></div>
    ${statusBar()}
    <div style="position:absolute;left:0;right:0;top:54px;display:flex;align-items:center;padding:6px 8px 8px;border-bottom:0.5px solid ${C.border}">
      <div style="flex:1;display:flex;align-items:center;gap:10px;padding-right:8px">
        <div style="width:44px;height:44px;margin-right:-6px;display:flex;align-items:center;justify-content:center">${ion('chevron-back', 28, C.text)}</div>
        ${face('maya', 40)}
        <div style="flex:1;display:flex;flex-direction:column"><span style="font-size:17px;font-weight:700;letter-spacing:-0.2px;color:${C.text}">Maya</span>
          <span style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:500;color:${C.success}"><span style="width:7px;height:7px;border-radius:4px;background:${C.success}"></span>Online</span></div>
      </div>
      <div style="display:flex">
        <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${ion('videocam', 27, C.accent)}</div>
        <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${ion('call', 25, C.accent)}</div>
      </div>
    </div>
    <div style="position:absolute;left:12px;right:12px;top:118px;bottom:96px;display:flex;flex-direction:column;justify-content:flex-end;gap:6px">
      <div style="align-self:center;font-size:12px;font-weight:700;color:${C.text3};background:${C.surfaceElevated};padding:4px 10px;border-radius:10px;margin-bottom:6px">Today</div>
      ${self('Good morning, safe flight today', '7:02')}
      ${partner('Landed!! Hotel wifi is a crime 😂', '8:51')}
      ${partner('How was the big presentation?', '8:52')}
      ${self('Nailed it. Thinking about you the whole time', '8:58')}
      <div style="align-self:flex-end;width:230px;border-radius:12px 12px 2px 12px;overflow:hidden">
        <img src="${photo('moment-sunset.jpg')}" style="display:block;width:100%;height:250px;object-fit:cover;object-position:62% 30%">
      </div>
      <div style="align-self:flex-end;margin-top:-14px;margin-right:12px;background:#fff;border:1px solid ${C.border};border-radius:12px;padding:2px 7px;font-size:14px;position:relative" class="emoji">❤️</div>
      ${partner('Okay that one is going on our wall 😭', '9:02')}
    </div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:92px;border-top:0.5px solid ${C.border};display:flex;align-items:flex-start;gap:4px;padding:6px 6px 0;box-sizing:border-box;background:#fff">
      <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${ion('image-outline', 28, C.text)}</div>
      <div style="flex:1;height:44px;border-radius:22px;background:${C.surface};border:0.5px solid ${C.border};box-sizing:border-box;display:flex;align-items:center;padding:0 6px 0 14px;font-size:16px;color:${C.text3}"><span style="flex:1">Message</span>${ion('happy-outline', 26, C.text)}</div>
      <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${ion('camera-outline', 28, C.text)}</div>
      <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${ion('mic-outline', 27, C.text)}</div>
    </div>
    ${homeIndicator()}`;
  },

  question: () => `<div style="position:absolute;inset:0;background:#fff"></div>
    ${statusBar()}
    <div style="position:absolute;left:0;right:0;top:54px;display:flex;flex-direction:column">
      ${appHeader(false)}
      <div style="padding:6px 16px 0;display:flex;flex-direction:column;gap:12px">${homeSection('Today')}${moodCard()}${questionCard()}</div>
    </div>
    ${tabBar('home')}${homeIndicator()}`,

  play: () => {
    const areas = [
      { id: 'knowing', title: 'Getting to know you', tone: { accent: '#C9922A', wash: '#FFF0D2' }, meta: '24 to try' },
      { id: 'story', title: 'Our story', tone: { accent: '#9A5B7C', wash: '#F2DFEA' }, meta: '2 of 6 done', p: 0.33 },
      { id: 'fun', title: 'Fun', tone: { accent: '#E07A5F', wash: '#FFE6DC' }, meta: '31 to try' },
      { id: 'romance', title: 'Romance', tone: { accent: '#E5577A', wash: '#FFE4EC' }, meta: '1 of 5 done', p: 0.2 },
      { id: 'communication', title: 'Communication', tone: { accent: '#4A8FB8', wash: '#DCEEF8' }, meta: '18 to try' },
      { id: 'distance', title: 'Long distance', tone: { accent: '#4A8FB8', wash: '#DCEEF8' }, meta: '20 to try' },
    ];
    const card = (a) => {
      const c = palette(a.tone);
      const art = AREA_ART[a.id] ? AREA_ART[a.id](c) : '';
      return `<div style="border-radius:26px;overflow:hidden;background:${c.bg}">
        <div style="width:100%;aspect-ratio:200/150">${art.replace('<svg', '<svg width="100%" height="100%"')}</div>
        <div style="padding:4px 14px 14px;display:flex;flex-direction:column;gap:3px">
          <span style="font-size:17px;font-weight:800;letter-spacing:-0.3px;line-height:21px;color:${c.d}">${a.title}</span>
          <span style="font-size:12px;font-weight:700;color:${shade(c.a, -0.3)}">${a.meta}</span>
          ${a.p ? `<div style="height:4px;border-radius:2px;margin-top:6px;background:${c.a}38"><div style="width:${a.p * 100}%;height:4px;border-radius:2px;background:${c.a}"></div></div>` : ''}
        </div></div>`;
    };
    const tab = (t, on) => `<div style="flex-grow:1;height:38px;padding:0 18px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:${on ? 800 : 700};${on ? `background:${C.accent};color:#fff` : `color:${C.text2}`}">${t}</div>`;
    return `<div style="position:absolute;inset:0;background:#fff"></div>
    ${statusBar()}
    <div style="position:absolute;left:0;right:0;top:54px;display:flex;flex-direction:column">
      ${appHeader(false)}
      <div style="padding:4px 16px 0;display:flex;flex-direction:column;gap:24px">
        <div style="display:flex;padding:4px;border-radius:999px;background:${C.surfaceElevated};border:0.5px solid ${C.border}">${tab('All', false)}${tab('Handpicked', true)}${tab('Endless', false)}</div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="font-size:23px;font-weight:900;letter-spacing:-0.4px;color:${C.text}">Areas</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${areas.map(card).join('')}</div>
        </div>
      </div>
    </div>
    ${tabBar('play')}${homeIndicator()}`;
  },

  streak: () => `<div style="position:absolute;inset:0;background:#fff"></div>
    <div style="position:absolute;left:0;right:0;top:0;height:200px;background:${C.hero}"></div>
    ${statusBar('#FFFFFF')}
    <div style="position:absolute;left:0;right:0;top:54px;display:flex;flex-direction:column">
      ${appHeader(true)}${welcomeCard()}
      <div style="padding:24px 16px 0;display:flex;flex-direction:column;gap:12px">${homeSection('Today')}${moodCard()}</div>
    </div>
    ${tabBar('home')}${homeIndicator()}`,

  // The Together page (src/app/calendar.tsx): ScreenHeader, Plan / Memories, whose plans, the
  // calendar card (PlanToolbar + PlanWeekStrip), the day (PlanDayView) and Coming up.
  together: () => {
    const chip = (label, people, on) => `<div style="flex:none;display:flex;align-items:center;gap:7px;padding:0 14px;height:38px;border-radius:19px;box-sizing:border-box;${on ? `background:${C.accent};border:1px solid ${C.accent}` : `background:${C.surface};border:1px solid ${C.border}`}">
      ${people.length ? `<div style="display:flex">${people.map((p, i) => `<div style="border:1.5px solid ${on ? C.accent : C.surface};border-radius:14px;${i ? 'margin-left:-8px' : ''}">${face(p, 24)}</div>`).join('')}</div>` : ''}
      <span style="font-size:14px;font-weight:700;color:${on ? '#fff' : C.text}">${label}</span></div>`;
    // Sun-first week (Oct 18-24, 2026), today Thursday 22; plans on Fri 23 and Sat 24.
    const week = [['S', 18], ['M', 19], ['T', 20], ['W', 21], ['T', 22, 'today'], ['F', 23, 'plan'], ['S', 24, 'plan']];
    const day = ([l, n, kind]) => {
      const today = kind === 'today';
      const circle = today
        ? `background:${C.accent};color:#fff;font-weight:800`
        : kind === 'plan'
          ? `background:rgba(94,76,203,0.12);border:1.5px solid rgba(94,76,203,0.55);color:${C.text};font-weight:700`
          : `color:${C.text};font-weight:500`;
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px">
        <span style="font-size:12px;font-weight:700;letter-spacing:0.4px;color:${today ? C.accent : C.text3}">${l}</span>
        <div style="width:38px;height:38px;border-radius:19px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:16px;${circle}">${n}</div>
        <div style="height:5px"></div></div>`;
    };
    const planRow = (time, ampm, tint, title, sub, people, first) => `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;min-height:64px;box-sizing:border-box;${first ? '' : `border-top:1px solid ${C.border}`}">
      <div style="width:60px;display:flex;flex-direction:column;align-items:flex-end"><span style="font-size:15px;font-weight:800;color:${C.text}">${time}</span><span style="font-size:11px;font-weight:700;color:${C.text3}">${ampm}</span></div>
      <div style="width:3px;align-self:stretch;border-radius:2px;background:${tint}"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:15px;font-weight:700;color:${C.text}">${title}</span><span style="font-size:13px;font-weight:600;color:${C.text2}">${sub}</span></div>
      <div style="display:flex">${people.map((p, i) => `<div style="border:2px solid ${C.surface};border-radius:16px;${i ? 'margin-left:-10px' : ''}">${face(p, 28)}</div>`).join('')}</div>
    </div>`;
    const upcoming = (n, m, soft, main, title, when, first) => `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;${first ? '' : `border-top:1px solid ${C.border}`}">
      <div style="width:40px;height:40px;border-radius:12px;background:${soft};display:flex;flex-direction:column;align-items:center;justify-content:center"><span style="font-size:15px;font-weight:900;line-height:17px;color:${main}">${n}</span><span style="font-size:9px;font-weight:800;letter-spacing:0.6px;color:${main}">${m}</span></div>
      <div style="flex:1;display:flex;flex-direction:column"><span style="font-size:15px;font-weight:700;letter-spacing:-0.2px;color:${C.text}">${title}</span><span style="font-size:13px;font-weight:600;margin-top:2px;color:${main}">${when}</span></div>
      ${ion('chevron-forward', 16, C.text3)}</div>`;
    return `<div style="position:absolute;inset:0;background:#fff"></div>
    ${statusBar()}
    <div style="position:absolute;left:0;right:0;top:54px;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:8px;padding:6px 20px 10px">
        <div style="width:44px;height:44px;margin-left:-10px"></div>
        <div style="flex:1;text-align:center;font-size:24px;font-weight:900;letter-spacing:-0.6px;color:${C.text}">Together</div>
        <div style="width:44px;height:44px;margin-right:-10px;display:flex;align-items:center;justify-content:center">${ion('chevron-forward', 28, C.text)}</div>
      </div>
      <div style="display:flex;margin:0 16px 14px;padding:4px;border-radius:999px;background:${C.surface};border:1px solid ${C.border}">
        <div style="flex:1;height:36px;border-radius:999px;background:${C.accent};color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center">Plan</div>
        <div style="flex:1;height:36px;border-radius:999px;color:${C.text2};font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center">Memories</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:24px;padding:0 16px">
        <div style="display:flex;gap:8px;margin-bottom:-10px;overflow:hidden">${chip('All', [], true)}${chip('Together', ['sam', 'maya'], false)}${chip('Me', ['sam'], false)}${chip('Maya', ['maya'], false)}</div>
        <div style="background:${C.surface};border:1px solid ${C.border};border-radius:28px;padding:14px 12px 10px">
          <div style="display:flex;align-items:center;gap:6px;min-height:36px;margin-bottom:12px"><span style="font-size:18px;font-weight:800;letter-spacing:-0.3px;color:${C.text}">October</span><span style="font-size:18px;font-weight:600;letter-spacing:-0.3px;color:${C.text3}">2026</span>${ion('chevron-down', 16, C.text2)}</div>
          <div style="display:flex">${week.map(day).join('')}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;padding:0 4px">
          <div style="display:flex;align-items:flex-end;justify-content:space-between"><div><div style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:${C.text}">Today</div><div style="font-size:13px;font-weight:600;margin-top:2px;color:${C.text2}">October 22, 2026</div></div>
            <div style="padding:0 12px;height:28px;border-radius:14px;background:${C.accentSoft};display:flex;align-items:center;font-size:13px;font-weight:700;color:${C.accent}">2 plans</div></div>
          <div style="background:${C.surface};border:1px solid ${C.border};border-radius:18px;overflow:hidden">
            ${planRow('6:30', 'PM', C.accent, 'Sunset walk', 'Together · Riverside Park', ['sam', 'maya'], true)}
            ${planRow('9:00', 'PM', '#5B8DEF', 'Call with her sister', 'Maya', ['maya'], false)}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;padding:0 4px">
          <span style="font-size:14px;font-weight:800;color:${C.text2}">Coming up</span>
          <div style="background:${C.surface};border:1px solid ${C.border};border-radius:20px;overflow:hidden">
            ${upcoming(23, 'OCT', C.accentSoft, C.accent, 'Dinner at Nonna’s', 'Tomorrow · 8:00 PM', true)}
            ${upcoming(14, 'DEC', 'rgba(163,95,0,0.16)', C.warning, 'Our anniversary', 'In 53 days · Mon, Dec 14', false)}
          </div>
        </div>
      </div>
    </div>
    <div style="position:absolute;right:20px;bottom:54px;width:60px;height:60px;border-radius:30px;background:${C.accent};display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(94,76,203,0.35)">${ion('add', 28, '#fff')}</div>
    ${homeIndicator()}`;
  },

  // A moment opened full screen (src/components/moments/MomentFocusViewer.tsx): always dark.
  viewer: () => {
    const strip = ['trip-gondola.jpg', 'date-candles-city.jpg', 'moment-sunset.jpg', 'trip-lake.jpg', 'date-wine.jpg', 'trip-peak.jpg', 'date-dining.jpg'];
    const cardTop = 122;
    const cardW = SW - 24;
    const cardH = Math.round(cardW / 0.75);
    return `<div style="position:absolute;inset:0;background:#000"></div>
    ${statusBar('#FFFFFF')}
    <div style="position:absolute;left:12px;top:${cardTop}px;width:${cardW}px;height:${cardH}px;border-radius:34px;overflow:hidden;box-shadow:0 10px 22px rgba(0,0,0,0.3)">
      <img src="${photo('moment-sunset.jpg')}" style="width:100%;height:100%;object-fit:cover;object-position:55% 35%">
    </div>
    <div style="position:absolute;left:0;right:0;top:0;padding:60px 12px 28px;display:flex;align-items:center;gap:10px;background:linear-gradient(rgba(0,0,0,0.65),rgba(0,0,0,0))">
      <div style="width:46px;height:46px;border-radius:23px;background:rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center">${ion('close', 28, '#fff')}</div>
      <div style="flex:1;display:flex;align-items:center;gap:10px;padding:0 4px">${face('maya', 36)}
        <div style="display:flex;flex-direction:column"><span style="font-size:16px;font-weight:800;color:#fff">Maya</span><span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.72);margin-top:1px">Today · 6:48 PM</span></div></div>
      <div style="height:30px;padding:0 12px;border-radius:15px;background:rgba(255,255,255,0.16);display:flex;align-items:center;font-size:13px;font-weight:800;color:#fff">3 of 12</div>
    </div>
    <div style="position:absolute;left:0;right:0;bottom:0;padding:40px 16px 44px;display:flex;flex-direction:column;gap:14px;background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0.78))">
      <span style="font-size:16px;font-weight:600;line-height:22px;color:#fff;padding:0 4px">Golden hour with you. Best part of my week</span>
      <div style="display:flex;gap:6px;padding:2px 0">${strip
        .map((p, i) => `<div style="flex:none;width:44px;height:44px;border-radius:10px;overflow:hidden;${i === 2 ? 'border:2px solid #fff;transform:scale(1.08);box-sizing:border-box' : 'opacity:0.55'}"><img src="${photo(p)}" style="width:100%;height:100%;object-fit:cover"></div>`)
        .join('')}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:46px;border-radius:23px;padding:0 18px;box-sizing:border-box;display:flex;align-items:center;background:rgba(255,255,255,0.12);border:0.5px solid rgba(255,255,255,0.22);font-size:15px;font-weight:500;color:rgba(255,255,255,0.55)">Reply to Maya…</div>
        <div style="width:46px;height:46px;border-radius:23px;background:rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center">${ion('send-outline', 18, 'rgba(255,255,255,0.6)')}</div>
      </div>
    </div>
    ${homeIndicator('#FFFFFF')}`;
  },

  // Our moments (src/components/moments/MomentHistoryModal.tsx, MomentAlbums.tsx, MomentPlaces.tsx).
  ourMoments: () => `<div style="position:absolute;inset:0;background:#fff"></div>
    ${statusBar()}
    <div style="position:absolute;left:0;right:0;top:54px;display:flex;flex-direction:column">
      ${pageHeader('Our moments', 'camera-outline')}
      <div style="padding:0 14px;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:18px;background:${C.surface};border:1px solid ${C.border};margin-bottom:18px">
          <div style="width:44px;height:44px;border-radius:14px;background:${C.accentSoft};display:flex;align-items:center;justify-content:center">${ion('map-outline', 22, C.accent)}</div>
          <div style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:15px;font-weight:800;color:${C.text}">Our map</span><span style="font-size:13px;color:${C.text2}">6 places · 48 moments</span></div>
          ${ion('chevron-forward', 18, C.text3)}
        </div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:14px"><span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:${C.text}">Albums</span><span style="font-size:14px;font-weight:700;color:${C.text3}">3</span></div>
        <div style="display:flex;gap:18px;padding-top:6px;margin-bottom:26px;overflow:hidden">
          ${albumFolder('Italy trip', 'airplane', 24, ['trip-gondola.jpg', 'trip-sunset-sea.jpg', 'trip-peak.jpg'])}
          ${albumFolder('Date nights', 'heart', 18, ['date-candles-city.jpg', 'date-dining.jpg', 'date-wine.jpg'])}
          ${albumFolder('Our firsts', 'star', 9, ['trip-lake.jpg', 'moment-sunset.jpg', 'date-roses.jpg'])}
        </div>
        ${monthGrid('October', 12, ['moment-sunset.jpg', 'date-candles-city.jpg', 'trip-lake.jpg', 'date-wine.jpg', 'trip-gondola.jpg', 'date-dining.jpg'])}
      </div>
    </div>
    ${floatingButton('albums', 'New album')}${homeIndicator()}`,

  // An open album: its cover edge to edge under the status bar, then its moments.
  album: () => `<div style="position:absolute;inset:0;background:#fff"></div>
    <div style="position:absolute;left:0;right:0;top:0;height:${54 + 250}px;border-radius:0 0 32px 32px;overflow:hidden;background:#000">
      <img src="${photo('trip-gondola.jpg')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 40%">
      <div style="position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,0.42) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0) 45%,rgba(0,0,0,0.62) 100%)"></div>
      <div style="position:absolute;left:20px;right:20px;bottom:22px;display:flex;flex-direction:column;gap:3px">
        <div style="width:34px;height:34px;border-radius:17px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;margin-bottom:6px">${ion('airplane', 18, '#fff')}</div>
        <span style="font-size:26px;font-weight:900;letter-spacing:-0.6px;color:#fff">Italy trip</span>
        <span style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.85)">24 moments · Jun 2026</span>
      </div>
    </div>
    ${statusBar('#FFFFFF')}
    <div style="position:absolute;left:12px;right:12px;top:60px;display:flex;justify-content:space-between;z-index:7">
      <div style="width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.78);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.18)">${ion('chevron-back', 24, '#1A1A1A')}</div>
      <div style="width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.78);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.18)">${ion('ellipsis-horizontal', 24, '#1A1A1A')}</div>
    </div>
    <div style="position:absolute;left:14px;right:14px;top:${54 + 250 + 18}px">
      ${monthGrid('June', 24, ['trip-sunset-sea.jpg', 'trip-peak.jpg', 'trip-balloons.jpg', 'trip-kayak.jpg', 'date-wine.jpg', 'trip-lake.jpg', 'date-string-lights.jpg', 'date-roses.jpg', 'moment-sunset.jpg'])}
    </div>
    ${floatingButton('add', 'Add to moments')}${homeIndicator()}`,

  // Together › Memories (src/components/calendar/plan/PlanMemoriesTab.tsx): the timeline.
  memories: () => {
    const chip = (label, icon, on) => `<div style="flex:none;display:flex;align-items:center;gap:6px;padding:0 14px;height:38px;border-radius:19px;box-sizing:border-box;${on ? `background:${C.accent};border:1px solid ${C.accent}` : `background:${C.surface};border:0.5px solid ${C.border}`}">${ion(icon, 18, on ? '#fff' : C.text)}<span style="font-size:14px;font-weight:700;color:${on ? '#fff' : C.text}">${label}</span></div>`;
    const badge = (icon, ink, label) => `<span style="display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:13px;background:${C.surface};border:1.5px solid ${C.border};box-sizing:border-box">${ion(icon, 12, ink)}<span style="font-size:12px;font-weight:800;color:${C.text}">${label}</span></span>`;
    return `<div style="position:absolute;inset:0;background:#fff"></div>
    ${statusBar()}
    <div style="position:absolute;left:0;right:0;top:54px;display:flex;flex-direction:column">
      ${togetherHeader('memories')}
      <div style="padding:0 16px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:center;gap:10px;height:44px;padding:0 14px;border-radius:14px;background:${C.surface};border:1px solid ${C.border}">${ion('search-outline', 18, C.text3)}<span style="font-size:15px;color:${C.text3}">Search memories, places…</span></div>
        <div style="display:flex;gap:8px;overflow:hidden;margin:0 -16px;padding:0 16px">${chip('All', 'albums-outline', true)}${chip('Milestone', 'flag-outline')}${chip('Date', 'heart-outline')}${chip('Trip', 'airplane-outline')}${chip('Celebration', 'balloon-outline')}</div>
        <div style="position:relative;padding:6px 0 0 34px;display:flex;flex-direction:column;gap:16px">
          <div style="position:absolute;left:11px;top:10px;bottom:-400px;width:2px;border-radius:1px;background:${C.border}"></div>
          <div style="position:relative">
            <div style="position:absolute;left:-29px;top:16px;width:12px;height:12px;border-radius:6px;background:#1D5BD8"></div>
            <div style="border-radius:22px;overflow:hidden;background:${C.sky};border:1px solid ${C.border}">
              <div style="position:relative;height:168px"><img src="${photo('trip-gondola.jpg')}" style="width:100%;height:100%;object-fit:cover;object-position:50% 45%">
                <div style="position:absolute;top:10px;left:10px;right:10px;display:flex;justify-content:space-between">${badge('airplane-outline', '#1D5BD8', 'Trip')}
                  <span style="display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:13px;background:rgba(0,0,0,0.55)">${ion('image-outline', 12, '#fff')}<span style="font-size:12px;font-weight:800;color:#fff">24</span></span></div></div>
              <div style="padding:14px;display:flex;flex-direction:column;gap:6px">
                <span style="font-size:19px;font-weight:900;letter-spacing:-0.4px;line-height:24px;color:${C.text}">Our first trip abroad</span>
                <span style="font-size:13px;font-weight:600;color:${C.text2}">14 June 2026</span>
                <span style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:${C.text2}">${ion('location-outline', 13, '#1D5BD8')}Venice, Italy</span>
                <div style="display:flex;gap:10px"><div style="width:3px;border-radius:2px;background:#1D5BD8"></div><span style="flex:1;font-size:14px;line-height:20px;font-style:italic;font-family:Georgia,serif;color:${C.text}">Getting lost was the best part.</span></div>
              </div>
            </div>
          </div>
          <div style="position:relative">
            <div style="position:absolute;left:-29px;top:16px;width:12px;height:12px;border-radius:6px;background:#B4451F"></div>
            <div style="position:relative;border-radius:22px;overflow:hidden;background:#FFCDB1;border:1px solid ${C.border};min-height:176px;padding:16px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px">
              <div style="position:absolute;right:-6px;bottom:-14px;transform:rotate(-12deg)">${ion('heart', 104, 'rgba(180,69,31,0.16)')}</div>
              <div style="display:flex;align-items:center;gap:10px"><span style="font-size:40px;font-weight:900;letter-spacing:-1.5px;line-height:44px;color:${C.text}">8</span><span style="font-size:16px;font-weight:800;color:${C.text}">March 2026</span></div>
              <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;line-height:27px;color:${C.text}">The night we couldn’t stop laughing</span>
              <div style="display:flex;gap:10px"><div style="width:3px;border-radius:2px;background:#B4451F"></div><span style="flex:1;font-size:16px;line-height:23px;font-style:italic;font-family:Georgia,serif;color:${C.text}">Burnt the pasta, ordered pizza.</span></div>
              <div style="display:flex;gap:6px;margin-top:auto;padding-top:4px">${badge('heart-outline', '#B4451F', 'Date')}${badge('location-outline', '#B4451F', 'Home')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div style="position:absolute;right:20px;bottom:54px;width:60px;height:60px;border-radius:30px;background:${C.accent};display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(94,76,203,0.35)">${ion('add', 28, '#fff')}</div>
    ${homeIndicator()}`;
  },

  // targets/widget/Widgets.swift (MomentWidget medium, DaysTogether and Streak small).
  widgets: () => {
    return `<img src="${photo('moment-sunset.jpg')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:60% 40%;filter:blur(14px) brightness(0.7);transform:scale(1.15)">
    ${statusBar('#FFFFFF')}
    <div style="position:absolute;left:18px;right:18px;top:72px;display:flex;flex-direction:column;gap:18px">
      <div style="height:170px;border-radius:24px;background:#fff;padding:11px;box-sizing:border-box;display:flex;gap:14px">
        <div style="width:148px;height:148px;border-radius:16px;overflow:hidden;flex:none"><img src="${photo('moment-sunset.jpg')}" style="width:100%;height:100%;object-fit:cover;object-position:62% 30%"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:4px;padding-top:2px">
          <span style="font-size:12px;font-weight:700;color:#5E5A6E">Maya</span>
          <span style="font-size:17px;font-weight:800;line-height:21px;color:#1A1A1A">Golden hour with you</span>
          <span style="font-size:12px;color:#5E5A6E">12 min ago</span>
          <span style="margin-top:auto;display:flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#1A1A1A"><span class="emoji" style="font-size:15px">😊</span>Feeling happy</span>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between">${wDays()}${wStreak()}</div>
      <div style="display:flex;justify-content:space-between;align-items:center">${wAnniversary()}
        <div style="width:170px;display:flex;flex-direction:column;align-items:center;gap:6px"><img src="${APP_ICON}" style="width:62px;height:62px;border-radius:14px"><span style="font-size:12px;color:#fff;font-weight:500">Moments</span></div>
      </div>
    </div>
    ${homeIndicator('#FFFFFF')}`;
  },
};

// ---- The widgets (targets/widget/Widgets.swift), with the streak page's stickers ----
// 312 days together since Mon Dec 14 2025, so the 1st anniversary is in 53 days; 48-day streak.
const STICKER = (name) => file(join(repo, 'targets/widget/stickers', name));
const W_INK = '#1A1A1A';
const W_INK2 = '#5E5A6E';
const roundedNum = (n, size) =>
  `<span style="font-family:Nunito,Inter,sans-serif;font-size:${size}px;font-weight:900;line-height:1;letter-spacing:-1px;color:${W_INK}">${n}</span>`;
const bar = (progress, tint) =>
  `<div style="height:6px;border-radius:3px;background:#FFFFFF;margin-top:8px"><div style="width:${progress * 100}%;height:6px;border-radius:3px;background:${tint}"></div></div>`;
function wDays() {
  return `<div style="width:170px;height:170px;border-radius:24px;background:#E3DDFF;padding:16px;box-sizing:border-box;display:flex;flex-direction:column">
    <img src="${STICKER('sticker-heart.png')}" style="width:36px">
    <div style="flex:1"></div>${roundedNum(312, 42)}
    <span style="font-size:15px;font-weight:800;color:${W_INK};margin-top:2px">days together</span>
    ${bar(312 / 365, '#FF4D6D')}
    <span style="font-size:11px;font-weight:700;color:${W_INK2};margin-top:4px">53 to 1 year</span>
  </div>`;
}
function wStreak() {
  return `<div style="width:170px;height:170px;border-radius:24px;background:#FFF1D6;padding:16px;box-sizing:border-box;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:flex-start"><img src="${STICKER('sticker-flame.png')}" style="width:38px">${ion('checkmark-circle', 22, W_INK2)}</div>
    <div style="flex:1"></div>${roundedNum(48, 42)}
    <span style="font-size:15px;font-weight:800;color:${W_INK};margin-top:2px">day streak</span>
    <span style="font-size:12px;font-weight:700;color:${W_INK2};margin-top:2px">Today’s safe</span>
  </div>`;
}
function wAnniversary() {
  const r = 24;
  const c = 2 * Math.PI * r;
  const p = 1 - 53 / 365;
  return `<div style="width:170px;height:170px;border-radius:24px;background:#FFE4EC;padding:16px;box-sizing:border-box;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="position:relative;width:54px;height:54px;flex:none">
        <svg width="54" height="54" style="position:absolute;inset:0"><circle cx="27" cy="27" r="${r}" fill="none" stroke="#FFFFFF" stroke-width="6"/>
          <circle cx="27" cy="27" r="${r}" fill="none" stroke="#FF4D6D" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 27 27)"/></svg>
        <img src="${STICKER('sticker-heart.png')}" style="position:absolute;left:14px;top:15px;width:26px">
      </div>
      <span style="font-size:13px;font-weight:800;color:#B0124A">Anniversary</span>
    </div>
    <div style="flex:1"></div>
    <div style="display:flex;align-items:baseline;gap:4px">${roundedNum(53, 40)}<span style="font-size:15px;font-weight:800;color:${W_INK}">days</span></div>
    <span style="font-size:12px;font-weight:700;color:${W_INK2};margin-top:2px">Your 1st · Mon, Dec 14</span>
  </div>`;
}

// ---- Around the phone (sizes are for the App Store canvas; `k` scales them for Play) ----
function notification(title, body, when = 'now') {
  const k = P.k;
  if (P.android) {
    // An Android heads-up notification: small app icon, "Moments · now", then the message.
    return `<div style="width:${820 * k}px;border-radius:${40 * k}px;background:#FFFFFF;padding:${28 * k}px ${34 * k}px;box-sizing:border-box;display:flex;gap:${22 * k}px;box-shadow:0 ${24 * k}px ${60 * k}px rgba(0,0,0,0.35);font-family:Roboto,sans-serif">
      <img src="${APP_ICON}" style="width:${56 * k}px;height:${56 * k}px;border-radius:50%;flex:none">
      <div style="flex:1;display:flex;flex-direction:column;gap:${4 * k}px">
        <span style="font-size:${26 * k}px;color:rgba(0,0,0,0.6)">${title} · ${when}</span>
        <span style="font-size:${32 * k}px;color:#1A1A1A;line-height:1.3">${body}</span>
      </div></div>`;
  }
  return `<div style="width:${800 * k}px;border-radius:${52 * k}px;background:#FFFFFF;padding:${30 * k}px ${34 * k}px;box-sizing:border-box;display:flex;align-items:center;gap:${26 * k}px;box-shadow:0 ${24 * k}px ${60 * k}px rgba(0,0,0,0.35)">
    <img src="${APP_ICON}" style="width:${84 * k}px;height:${84 * k}px;border-radius:${20 * k}px;flex:none">
    <div style="flex:1;display:flex;flex-direction:column;gap:2px">
      <div style="display:flex;justify-content:space-between"><span style="font-size:${32 * k}px;font-weight:700;color:#1A1A1A">${title}</span><span style="font-size:${28 * k}px;color:rgba(0,0,0,0.5)">${when}</span></div>
      <span style="font-size:${31 * k}px;color:#1A1A1A;line-height:1.3">${body}</span>
    </div></div>`;
}
function print(src, caption, pos = '50% 40%', w = 440, h = 300) {
  const k = P.k;
  return `<div style="width:${(w + 36) * k}px;background:#fff;padding:${18 * k}px ${18 * k}px ${24 * k}px;border-radius:${34 * k}px;box-sizing:border-box;display:flex;flex-direction:column;gap:${18 * k}px;box-shadow:0 ${24 * k}px ${60 * k}px rgba(0,0,0,0.4)">
    <img src="${photo(src)}" style="width:${w * k}px;height:${h * k}px;object-fit:cover;object-position:${pos};border-radius:${22 * k}px;display:block">
    <span style="padding:0 ${8 * k}px ${4 * k}px;font-size:${34 * k}px;font-weight:800;color:#1A1A1A;white-space:nowrap">${caption}</span></div>`;
}
const at = (style, inner) => `<div style="position:absolute;${style}">${inner}</div>`;
const px = (n) => `${n * P.k}px`;

// ---- The screenshots: one night-blue ground, one headline style ----
const BG = '#1F1B3A';
const INK = '#FFFFFF';
const ACCENT = '#FF4D6D';
const SHOTS = [
  {
    file: '01-home', screen: 'home', head: 'A private world', em: 'for two.', sub: 'Moments, chats and memories only your person sees.',
    extra: () => at(`left:${px(-55)};bottom:${px(90)};transform:rotate(-7deg);zoom:${1.9 * P.k};border-radius:24px;box-shadow:0 16px 40px rgba(0,0,0,0.45)`, wDays()),
  },
  {
    file: '02-moments', screen: 'moments', head: 'See their day', em: 'as it happens.', sub: 'Photos and videos from your person. Never a public feed.',
    extra: () => at(`left:${px(-50)};top:${px(24)}`, notification('Moments', '<b>Maya</b> shared a moment: Golden hour with you')),
  },
  { file: '03-chat', screen: 'chat', head: 'Talk like it’s', em: 'just you two.', sub: 'Messages, photos, voice notes and calls in one place.' },
  { file: '04-question', screen: 'question', head: 'One question', em: 'a day.', sub: 'Share how you feel, answer, then see what they said.' },
  {
    file: '05-play', screen: 'play', head: 'Play,', em: 'made for two.', sub: 'Questions, quizzes and games for every mood.',
    extra: () => at(`right:${px(-200)};bottom:${px(-20)};transform:rotate(6deg)`, print('play-piggyback.jpg', 'Game night, sorted', '50% 35%')),
  },
  {
    file: '06-streak', screen: 'streak', head: 'Never miss', em: 'a day.', sub: 'Keep your streak alive together. Miss one? Bring it back.',
    extra: () => at(`right:${px(-170)};bottom:${px(-30)};transform:rotate(10deg);filter:drop-shadow(0 30px 40px rgba(0,0,0,0.5))`, stickerFlame(400 * P.k, { face: true })),
  },
  {
    file: '07-together', screen: 'together', head: 'Plan it', em: 'together.', sub: 'One calendar for both of you, with reminders before each plan.',
    // Play's canvas is shorter: the reminder sits over the phone instead of hanging below it.
    extra: () => at(`left:${px(-60)};bottom:${px(P.android ? 200 : -70)}`, notification('Moments', '<b>Dinner at Nonna’s</b> starts in 1 hour', '7:00 PM')),
  },
  // The widgets are iPhone only, so this one is for the App Store set alone.
  { file: '08-widgets', screen: 'widgets', head: 'Them, on your', em: 'Home Screen.', sub: 'Their latest photo, your days together and your streak.', iosOnly: true },
  // Candidates to choose from (App Store allows 10, Google Play 8).
  { file: '09-moment', screen: 'viewer', head: 'Every moment,', em: 'up close.', sub: 'Swipe through their photos and reply to any of them.' },
  {
    file: '10-our-moments', screen: 'ourMoments', head: 'All of it,', em: 'in one place.', sub: 'Every photo and video you’ve shared, by month and on a map.',
  },
  { file: '11-album', screen: 'album', head: 'Albums for', em: 'your best days.', sub: 'Keep trips, date nights and firsts together.' },
  { file: '12-memories', screen: 'memories', head: 'Your story,', em: 'remembered.', sub: 'Dates, trips and milestones on one timeline.' },
];

// The giant logo mark straddles each pair (1|2, 3|4, 5|6, 7|8): half on each, so side by side
// in the store the two screenshots read as one picture.
function panoramaMark(index) {
  const size = 1700 * (W / 1290);
  const left = index % 2 === 0 ? W - size / 2 : -size / 2;
  return `<div style="position:absolute;left:${left}px;top:${H * 0.42}px;width:${size}px;height:${size}px;opacity:0.10">${mark(size, ACCENT)}</div>`;
}

function page(s, index, capDir) {
  const capture = join(capDir, `${s.file}.png`);
  const screen = existsSync(capture)
    ? `<img src="${file(capture)}" style="display:block;width:100%;height:100%;object-fit:cover">`
    : `<div style="position:absolute;left:0;top:0;width:${SW}px;height:${SH}px;transform:scale(${SCALE});transform-origin:0 0;overflow:hidden">${SCREENS[s.screen]()}</div>`;
  const pw = SW * SCALE + BEZEL * 2;
  const ph = SH * SCALE + BEZEL * 2;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700;800;900&family=Roboto:wght@400;500;700;800;900&family=Nunito:wght@900&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
<style>@font-face{font-family:Ionicons;src:url('${ION_FONT}') format('truetype')}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}*{font-family:${P.font},'Noto Color Emoji',sans-serif}.emoji{font-family:'Noto Color Emoji',sans-serif}b{font-weight:700}</style></head>
<body><div style="width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${BG};display:flex;flex-direction:column;align-items:center">
  ${panoramaMark(index)}
  <div style="position:relative;width:100%;box-sizing:border-box;padding:${P.padTop}px ${W * 0.047}px 0;text-align:center">
    <h1 style="margin:0;font-family:'DM Serif Display',serif;font-weight:400;font-size:${P.head}px;line-height:1.0;letter-spacing:-1px;color:${INK}">${s.head}<br><em style="font-family:'DM Serif Display',serif;font-style:italic;color:${ACCENT}">${s.em}</em></h1>
    <p style="margin:${P.subGap}px auto 0;max-width:${W * 0.84}px;font-size:${P.sub}px;line-height:1.28;font-weight:500;color:rgba(255,255,255,0.82);text-wrap:balance">${s.sub}</p>
  </div>
  <div style="flex:none;margin-top:${P.phoneGap}px;position:relative;width:${pw}px;height:${ph}px">
    <div style="position:absolute;inset:0;border-radius:${P.RADIUS * SCALE + BEZEL}px;background:#0B0A14;box-shadow:0 0 0 ${4 * P.k}px #3A3560,0 ${50 * P.k}px ${110 * P.k}px rgba(0,0,0,0.55)"></div>
    <div style="position:absolute;left:${BEZEL}px;top:${BEZEL}px;width:${SW * SCALE}px;height:${SH * SCALE}px;border-radius:${P.RADIUS * SCALE}px;overflow:hidden;background:#fff">${screen}</div>
    ${s.extra ? s.extra() : ''}
  </div>
</div></body></html>`;
}

// Usage: node app-screenshots/_source/render.mjs [appstore|playstore] [file prefix]
const [onlyStore, onlyFile] = process.argv.slice(2);
mkdirSync(tmpDir, { recursive: true });
for (const store of Object.keys(PLATFORMS)) {
  if (onlyStore && store !== onlyStore) continue;
  usePlatform(store);
  const outDir = join(root, 'screenshots', store);
  const capDir = join(root, 'captures', store);
  mkdirSync(outDir, { recursive: true });
  SHOTS.filter((s) => !(s.iosOnly && P.android)).forEach((s, i) => {
    if (onlyFile && !s.file.startsWith(onlyFile)) return;
    const html = join(tmpDir, `${store}-${s.file}.html`);
    writeFileSync(html, page(s, i, capDir));
    const out = join(outDir, `${s.file}.png`);
    execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
      '--run-all-compositor-stages-before-draw', '--disable-features=PaintHolding', '--disable-gpu-compositing',
      '--force-device-scale-factor=1', `--window-size=${W},${H}`, '--virtual-time-budget=8000',
      `--screenshot=${out}`, file(html),
    ], { stdio: 'ignore' });
    console.log(`${store}  ${existsSync(join(capDir, `${s.file}.png`)) ? 'capture' : 'drawn  '}  ${s.file}.png`);
  });
}
// Google Play's listing graphics: the feature graphic (1024 x 500, required) and the 512 icon.
function shoot(name, html, w, h) {
  const path = join(tmpDir, `${name}.html`);
  writeFileSync(path, html);
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    '--force-device-scale-factor=1', `--window-size=${w},${h}`, '--virtual-time-budget=6000',
    `--screenshot=${join(root, 'screenshots', 'playstore', `${name}.png`)}`, file(path),
  ], { stdio: 'ignore' });
  console.log(`playstore  drawn    ${name}.png`);
}
if (!onlyStore || onlyStore === 'playstore') {
  usePlatform('playstore');
  shoot('feature-graphic', `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Roboto:wght@500&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1024px;height:500px;overflow:hidden}</style></head>
<body><div style="position:relative;width:1024px;height:500px;background:${BG};overflow:hidden">
  <div style="position:absolute;right:-60px;top:-40px;width:560px;height:560px;opacity:0.12">${mark(560, ACCENT)}</div>
  <div style="position:absolute;left:72px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:18px">
    <div style="display:flex;align-items:center;gap:18px"><img src="${APP_ICON}" style="width:84px;height:84px;border-radius:20px">
      <span style="font-family:'DM Serif Display',serif;font-size:56px;color:#fff">Moments</span></div>
    <div style="font-family:'DM Serif Display',serif;font-size:66px;line-height:1.02;color:#fff">A private world<br><em style="font-style:italic;color:${ACCENT}">for two.</em></div>
    <div style="font-family:Roboto,sans-serif;font-size:24px;font-weight:500;color:rgba(255,255,255,0.8)">Moments, chats, games and plans, just for couples.</div>
  </div>
  <img src="${photo('moment-sunset.jpg')}" style="position:absolute;right:70px;top:70px;width:300px;height:360px;object-fit:cover;object-position:55% 35%;border-radius:28px;border:8px solid #fff;transform:rotate(5deg);box-shadow:0 20px 50px rgba(0,0,0,0.45)">
</div></body></html>`, 1024, 500);
  shoot('play-icon-512', `<!doctype html><html><body style="margin:0;width:512px;height:512px;overflow:hidden"><img src="${APP_ICON}" style="display:block;width:512px;height:512px"></body></html>`, 512, 512);
}
rmSync(tmpDir, { recursive: true, force: true });
