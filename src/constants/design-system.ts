export type AppTheme = 'default' | 'dark' | 'night' | 'violet' | 'amethyst' | 'blue' | 'coral' | 'cream' | 'paper' | 'color';

/** Pastel card fills, one per part of the app (as Wrapped gives each story its own colour). */
export type Tint = 'butter' | 'blush' | 'peach' | 'sky' | 'lilac' | 'mint';

export interface ThemeColors {
  /** Identity */
  isDark: boolean;
  glass: boolean;
  /** Bold outlined cards/buttons instead of the usual hairline border (e.g. `paper`). */
  boldBorder?: boolean;
  /** The onboarding / Wrapped sticker look: ink outlines, pastel cards, pill buttons, heavier headings. */
  sticker?: boolean;
  /** Surfaces */
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceElevated: string;
  surfaceGlass: string;
  /** Text */
  text: string;
  textSecondary: string;
  textTertiary: string;
  onAccent: string;
  /** Brand */
  accent: string;
  accentSoft: string;
  accentMuted: string;
  /** Decorative highlight (badges, dots, progress, selected marks). Not for text: use `highlightText`. */
  highlight: string;
  /** The highlight colour when it has to be readable as text. */
  highlightText: string;
  /** Achievement yellow (lit streak days, earned badges), always with an ink outline. */
  lit: string;
  tints: Record<Tint, string>;
  /** Each card's own icon colour (dark themes: the full system colour over its tinted card). */
  tintAccents?: Record<Tint, string>;
  /** Gradients */
  gradient: [string, string];
  /** Text and icons on `gradient` / the hero gradient. */
  onGradient: string;
  /** Home / Streak hero and the You band; derived from `gradient` when not set. */
  hero?: [string, string, string];
  /** Text and icons on `hero` (the pastel heroes are ink); `onGradient` when not set. */
  onHero?: string;
  gradientHero: [string, string, string];
  /** Feedback */
  border: string;
  borderStrong: string;
  success: string;
  warning: string;
  error: string;
  /** Chat */
  chatBubbleSelf: string;
  chatBubblePartner: string;
  chatBackground: string;
  chatBubbleSelfText: string;
  chatReadReceipt: string;
  /** The launch screen behind the logo: the theme's own colour (page colour when not set). */
  splash?: string;
  /** The logo on the launch screen (the mark's own coral when not set; white on vivid backgrounds). */
  splashMark?: string;
  /** Shadow */
  shadow: string;
}

/** The new fields, for themes that keep their original look (tints = their own card colour). */
function classic(surface: string, accent: string, onAccent: string) {
  return {
    highlight: accent,
    highlightText: accent,
    lit: '#FFE7A0',
    onGradient: onAccent,
    tints: {
      butter: surface,
      blush: surface,
      peach: surface,
      sky: surface,
      lilac: surface,
      mint: surface,
    },
  };
}

const INK = '#1A1A1A';
const BUTTER = '#FFE7A0';
const LILAC = '#E3DDFF';
const PEACH = '#FFD9CC';
const PASTELS = {
  butter: BUTTER,
  // Mood card only: a deeper rose (the Play page's pink). Its text is ink and the 70% grey (>= 4.5:1).
  blush: '#F1A3B6',
  peach: PEACH,
  sky: '#DCEBFF',
  lilac: LILAC,
  mint: '#D7F2E3',
};
/**
 * Dark: Apple's raised grey (#1C1C1E) with 14% of an Apple system colour washed in, the way Health,
 * Fitness and widgets do it; the full colour goes on each card's icon. White text >= 5.1:1, icons >= 3.9:1.
 */
const DARK_TINTS = {
  butter: '#25253A', // today's question: indigo
  blush: '#582E3A', // mood: a clear rose (the Play page's pink)
  peach: '#3C2E1B', // on this day: orange
  sky: '#26353E', // next plan: teal
  lilac: '#33253C', // chat: purple
  mint: '#192B3E', // Play: blue
};
const DARK_TINT_ACCENTS = {
  butter: '#7D7AFF', // indigo (high-contrast variant: the standard one is under 3:1 here)
  blush: '#FF7A93', // light coral-pink, clear on the rose card (4.5:1)
  peach: '#FF9F0A',
  sky: '#64D2FF',
  lilac: '#BF5AF2',
  mint: '#0A84FF',
};
/**
 * Night: the same approach over its navy card (#2A2550, 16% wash). Today's question is yellow here
 * (indigo would merge with the purple chat card on navy); icons use Apple's high-contrast variants.
 */
const NIGHT_TINTS = {
  butter: '#4C4145', // today's question: yellow
  blush: '#5E335C', // mood: a clear rose
  peach: '#4C3945', // on this day: orange
  sky: '#33416C', // next plan: teal
  lilac: '#422D6A', // chat: purple
  mint: '#25346C', // Play: blue
};
const NIGHT_TINT_ACCENTS = {
  butter: '#FFD60A',
  blush: '#FF6482',
  peach: '#FF9F0A',
  sky: '#64D2FF',
  lilac: '#DA8FFF',
  mint: '#409CFF',
};
/** Brighter Home cards for Ultraviolet, Ocean, Sunset and Honey. */
const BRIGHT_PASTELS = { butter: '#FFE680', blush: '#F1A3B6', peach: '#FFCDB1', sky: '#B8D9FF', lilac: '#DCD1FF', mint: '#B2EFD1' };
/** Flat fills: these themes use no gradients (a gradient of one colour draws flat). */
const flat2 = (c: string): [string, string] => [c, c];
const flat3 = (c: string): [string, string, string] => [c, c, c];

/**
 * The soft light themes share one layout (the onboarding / Rate Moments / achievement look: heavy
 * headings, pill buttons, pastel cards) and differ only in colour. No thick lines: on a white page a
 * card is a light tinted panel with a soft edge, so it stays visible without an outline. Every text
 * colour here is at least 4.5:1 on every surface and pastel.
 */
function softLight(c: {
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceElevated: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  accentMuted: string;
  highlight: string;
  highlightText: string;
  hero: string;
  /** Text on the hero (ink unless the hero is a deep colour). */
  onHero?: string;
  /** The Home card pastels (default: the soft set). */
  tints?: Record<Tint, string>;
  border: string;
  borderStrong: string;
  chatBubbleSelf: string;
  chatBubbleSelfText: string;
  chatBubblePartner: string;
}): ThemeColors {
  return {
    isDark: false,
    glass: false,
    sticker: true,
    background: c.background,
    backgroundElevated: c.backgroundElevated,
    surface: c.surface,
    surfaceElevated: c.surfaceElevated,
    surfaceGlass: 'rgba(26,26,26,0.04)',
    text: INK,
    textSecondary: 'rgba(26,26,26,0.70)',
    textTertiary: 'rgba(26,26,26,0.66)',
    onAccent: c.onAccent,
    accent: c.accent,
    accentSoft: c.accentSoft,
    accentMuted: c.accentMuted,
    highlight: c.highlight,
    highlightText: c.highlightText,
    lit: BUTTER,
    tints: c.tints ?? PASTELS,
    gradient: flat2(c.accent),
    onGradient: c.onAccent,
    hero: flat3(c.hero),
    onHero: c.onHero ?? INK,
    gradientHero: flat3(c.background),
    border: c.border,
    borderStrong: c.borderStrong,
    success: '#18783F',
    warning: '#A35F00',
    error: '#C8372F',
    chatBubbleSelf: c.chatBubbleSelf,
    chatBubblePartner: c.chatBubblePartner,
    chatBackground: c.background,
    chatBubbleSelfText: c.chatBubbleSelfText,
    chatReadReceipt: c.highlightText,
    shadow: '#000000',
  };
}

/** Default: the onboarding look. White page, ink pill buttons, butter hero, pastel cards with soft edges. */
const DEFAULT = softLight({
  background: '#FFFFFF',
  backgroundElevated: '#F6F6F6',
  surface: '#F7F7F8',
  surfaceElevated: '#EFEFF1',
  accent: INK,
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(26,26,26,0.08)',
  accentMuted: '#ECECEC',
  highlight: INK,
  highlightText: INK,
  hero: BUTTER,
  border: '#E8E8EA',
  borderStrong: '#D4D4D8',
  chatBubbleSelf: INK,
  chatBubbleSelfText: '#FFFFFF',
  chatBubblePartner: '#F2F2F4',
});

/**
 * Dark: Apple's dark-mode greys (system background and grouped surfaces), white text, white pill
 * buttons, soft edges, butter hero and deep pastel cards. Every text colour is at least 4.5:1.
 */
const DARK: ThemeColors = {
  isDark: true,
  glass: false,
  sticker: true,
  background: '#0E0E0E',
  backgroundElevated: '#161616',
  surface: '#1C1C1E',
  // A step above the cards (Apple's #2C2C2E read too light for chips, sheets and Play's cards).
  surfaceElevated: '#242426',
  surfaceGlass: 'rgba(255,255,255,0.06)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.72)',
  textTertiary: 'rgba(255,255,255,0.56)',
  onAccent: INK,
  accent: '#FFFFFF',
  accentSoft: 'rgba(255,255,255,0.10)',
  accentMuted: '#2C2C2E',
  highlight: '#FFFFFF',
  highlightText: '#FFFFFF',
  lit: BUTTER,
  tints: DARK_TINTS,
  tintAccents: DARK_TINT_ACCENTS,
  gradient: flat2('#FFFFFF'),
  onGradient: INK,
  hero: flat3(BUTTER),
  onHero: INK,
  gradientHero: flat3('#0E0E0E'),
  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.22)',
  success: '#5ACB8F',
  warning: '#E5B567',
  error: '#FF6B6B',
  chatBubbleSelf: '#FFFFFF',
  chatBubblePartner: '#2C2C2E',
  chatBackground: '#0E0E0E',
  chatBubbleSelfText: INK,
  chatReadReceipt: '#FFFFFF',
  shadow: '#000000',
};

/** The logo: its coral-pink heart and the night blue tile behind it on the app icon. */
const LOGO_PINK = '#FF4D6D';
const NIGHT_BLUE = '#1F1B3A';

/**
 * Night: the app icon's night blue as the page, with the logo's pink for buttons (navy text on it,
 * 5.1:1) and a lighter pink for pink text (6.6:1). Every text colour is at least 4.5:1.
 */
const NIGHT: ThemeColors = {
  isDark: true,
  glass: false,
  sticker: true,
  background: NIGHT_BLUE,
  backgroundElevated: '#252046',
  surface: '#2A2550',
  surfaceElevated: '#353060',
  surfaceGlass: 'rgba(255,255,255,0.06)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.74)',
  textTertiary: 'rgba(255,255,255,0.58)',
  onAccent: NIGHT_BLUE,
  accent: LOGO_PINK,
  accentSoft: 'rgba(255,77,109,0.18)',
  accentMuted: '#3A2F5C',
  highlight: LOGO_PINK,
  highlightText: '#FF7A93',
  lit: BUTTER,
  tints: NIGHT_TINTS,
  tintAccents: NIGHT_TINT_ACCENTS,
  gradient: flat2(LOGO_PINK),
  onGradient: NIGHT_BLUE,
  hero: flat3(LOGO_PINK),
  onHero: NIGHT_BLUE,
  gradientHero: flat3(NIGHT_BLUE),
  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.22)',
  success: '#5ACB8F',
  warning: '#E5B567',
  error: '#FF8A8A',
  chatBubbleSelf: LOGO_PINK,
  chatBubblePartner: '#353060',
  chatBackground: NIGHT_BLUE,
  chatBubbleSelfText: NIGHT_BLUE,
  chatReadReceipt: '#FF7A93',
  shadow: '#000000',
};

/** Violet from the onboarding characters (ink on it is 5.2:1). */
const VIOLET = '#8C7CF0';
/** Deeper violet for buttons and violet text: white on it is 6.2:1 (the bright one is only 3.4:1). */
const VIOLET_DEEP = '#5E4CCB';

/** Violet: the Rate Moments page look. White page, violet buttons and accents, lilac hero. */
const VIOLET_LIGHT = softLight({
  background: '#FFFFFF',
  backgroundElevated: '#F7F5FF',
  surface: '#F0ECFF',
  surfaceElevated: '#EDE9F9',
  accent: VIOLET_DEEP,
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(140,124,240,0.16)',
  accentMuted: LILAC,
  highlight: VIOLET,
  highlightText: VIOLET_DEEP,
  hero: VIOLET_DEEP,
  onHero: '#FFFFFF',
  tints: BRIGHT_PASTELS,
  border: '#E6E2F5',
  borderStrong: '#D2CCEB',
  chatBubbleSelf: VIOLET_DEEP,
  chatBubbleSelfText: '#FFFFFF',
  chatBubblePartner: '#F1EEFB',
});

/** Amethyst's bright orchid purple, for highlights (decorative, not text). */
const AMETHYST = '#A855F7';
/** Deep royal purple for buttons, text and the hero: white on it is 7.0:1. */
const AMETHYST_DEEP = '#7E22CE';

/**
 * Amethyst: a warm, jewel-toned purple, redder and richer than Ultraviolet's blue-violet. White
 * page, royal-purple buttons and hero, orchid highlights, soft pink-purple cards.
 */
const AMETHYST_LIGHT = softLight({
  background: '#FFFFFF',
  backgroundElevated: '#FBF6FF',
  surface: '#F5EBFF',
  surfaceElevated: '#F1E4FD',
  accent: AMETHYST_DEEP,
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(168,85,247,0.14)',
  accentMuted: '#EBD9FF',
  highlight: AMETHYST,
  highlightText: AMETHYST_DEEP,
  hero: AMETHYST_DEEP,
  onHero: '#FFFFFF',
  tints: BRIGHT_PASTELS,
  border: '#EEDFFB',
  borderStrong: '#DCC5F4',
  chatBubbleSelf: AMETHYST_DEEP,
  chatBubbleSelfText: '#FFFFFF',
  chatBubblePartner: '#F7EFFF',
});

/** Blue: white page, deep-blue buttons (white text on them 5.9:1), bright-blue highlights, sky hero. */
const BLUE_DEEP = '#1D5BD8';
const BLUE_LIGHT = softLight({
  background: '#FFFFFF',
  backgroundElevated: '#F5F9FF',
  surface: '#EAF2FF',
  surfaceElevated: '#E4EEFD',
  accent: BLUE_DEEP,
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(59,130,246,0.14)',
  accentMuted: '#DCEBFF',
  highlight: '#3B82F6',
  highlightText: BLUE_DEEP,
  hero: BLUE_DEEP,
  onHero: '#FFFFFF',
  tints: BRIGHT_PASTELS,
  border: '#DCE6F7',
  borderStrong: '#C5D5EE',
  chatBubbleSelf: BLUE_DEEP,
  chatBubbleSelfText: '#FFFFFF',
  chatBubblePartner: '#EEF4FF',
});

/** Coral from the onboarding characters. */
const CORAL = '#FF8A65';
/** Deeper coral for buttons and coral text: white on it is 5.4:1 (the bright one is only 2.3:1). */
const CORAL_DEEP = '#B8441E';

/** Coral: white page, coral buttons and accents, peach hero. */
const CORAL_LIGHT = softLight({
  background: '#FFFFFF',
  backgroundElevated: '#FFF7F3',
  surface: '#FFEDE4',
  surfaceElevated: '#FFE9E0',
  accent: CORAL_DEEP,
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(255,138,101,0.16)',
  accentMuted: PEACH,
  highlight: CORAL,
  highlightText: CORAL_DEEP,
  hero: CORAL,
  tints: BRIGHT_PASTELS,
  border: '#F3DED6',
  borderStrong: '#E8C9BD',
  chatBubbleSelf: CORAL_DEEP,
  chatBubbleSelfText: '#FFFFFF',
  chatBubblePartner: '#FFEEE7',
});

/** Cream: the first look. Warm cream page, white cards, ink buttons, coral highlights and hero. */
const CREAM_LIGHT = softLight({
  background: '#FFF8EE',
  backgroundElevated: '#FFF1DF',
  surface: '#FFFFFF',
  surfaceElevated: '#FBEFDD',
  accent: INK,
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(26,26,26,0.08)',
  accentMuted: '#EFE4D3',
  highlight: CORAL,
  highlightText: CORAL_DEEP,
  hero: '#FF9F43',
  tints: BRIGHT_PASTELS,
  border: '#EFE3D2',
  borderStrong: '#E2D2BC',
  chatBubbleSelf: CORAL,
  chatBubbleSelfText: INK,
  chatBubblePartner: '#FFFFFF',
});

/** Color's buttons: electric blue (white text on it, and it as text on white, both 5.2:1). */
const ELECTRIC_BLUE = '#2E5BFF';
const SUNNY = '#FFD93D';

/**
 * Color: Paper's layout and 2pt black outlines, made colourful in the neo-brutalist way. White page,
 * black text, soft-butter cards and inputs and light-blue sheets and chips on every page, candy-bright
 * Home cards (black text on all of them >= 5.1:1), a sunny yellow hero and electric-blue buttons.
 * Flat, no gradients.
 */
const COLOR: ThemeColors = {
  isDark: false,
  glass: false,
  boldBorder: true,
  background: '#FFFFFF',
  // Icon tiles, pills and tracks: soft pink instead of Paper's grey.
  backgroundElevated: '#FFE3EE',
  surface: '#FFF2CC',
  surfaceElevated: '#EBF1FF',
  surfaceGlass: 'rgba(0,0,0,0.04)',
  text: '#000000',
  textSecondary: 'rgba(0,0,0,0.70)',
  textTertiary: 'rgba(0,0,0,0.64)',
  onAccent: '#FFFFFF',
  accent: ELECTRIC_BLUE,
  accentSoft: 'rgba(46,91,255,0.12)',
  accentMuted: '#DCE4FF',
  highlight: ELECTRIC_BLUE,
  highlightText: ELECTRIC_BLUE,
  lit: SUNNY,
  tints: {
    butter: SUNNY, // today's question
    blush: '#FF9EC4', // mood
    peach: '#FFB38A', // on this day
    sky: '#8EC5FF', // next plan
    lilac: '#C3B1FF', // chat
    mint: '#88E3B5', // Play
  },
  gradient: flat2(ELECTRIC_BLUE),
  onGradient: '#FFFFFF',
  hero: flat3(SUNNY),
  onHero: '#000000',
  gradientHero: flat3('#FFFFFF'),
  border: '#000000',
  borderStrong: '#000000',
  success: '#18783F',
  warning: '#A35F00',
  error: '#C8372F',
  chatBubbleSelf: ELECTRIC_BLUE,
  chatBubblePartner: '#FFE9F2',
  chatBackground: '#FFFFFF',
  chatBubbleSelfText: '#FFFFFF',
  chatReadReceipt: ELECTRIC_BLUE,
  shadow: '#000000',
};

export const Themes: Record<AppTheme, ThemeColors> = {
  default: DEFAULT,
  // Launch screen: pure black with the coral logo (6.5:1).
  dark: { ...DARK, splash: '#000000' },
  night: NIGHT,
  // Launch screen: vivid violet with a white logo (4.2:1).
  violet: { ...VIOLET_LIGHT, splash: '#7B69E8', splashMark: '#FFFFFF' },
  // Launch screen: vivid purple with a white logo (5.4:1).
  amethyst: { ...AMETHYST_LIGHT, splash: '#9333EA', splashMark: '#FFFFFF' },
  // Launch screen: vivid coral with a white logo (3.2:1; the coral heart would vanish on it).
  // Launch screen: royal blue with a white logo (5.2:1).
  blue: { ...BLUE_LIGHT, splash: '#2563EB', splashMark: '#FFFFFF' },
  coral: { ...CORAL_LIGHT, splash: '#EE633C', splashMark: '#FFFFFF' },
  cream: CREAM_LIGHT,
  paper: {
    isDark: false,
    glass: false,
    boldBorder: true,
    background: '#FFFFFF',
    backgroundElevated: '#F5F5F5',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceGlass: 'rgba(0,0,0,0.04)',
    text: '#000000',
    textSecondary: 'rgba(0,0,0,0.68)',
    textTertiary: 'rgba(0,0,0,0.46)',
    onAccent: '#FFFFFF',
    accent: '#000000',
    accentSoft: 'rgba(0,0,0,0.08)',
    accentMuted: '#E8E8E8',
    gradient: ['#000000', '#2A2A2A'],
    gradientHero: ['#FFFFFF', '#F5F5F5', '#FFFFFF'],
    border: '#000000',
    borderStrong: '#000000',
    success: '#1F8A4C',
    warning: '#B8860B',
    error: '#D9524E',
    chatBubbleSelf: '#000000',
    chatBubblePartner: '#F0F0F0',
    chatBackground: '#FFFFFF',
    chatBubbleSelfText: '#FFFFFF',
    chatReadReceipt: '#000000',
    shadow: '#000000',
    ...classic('#FFFFFF', '#000000', '#FFFFFF'),
  },
  // Launch screen: sunny yellow with the logo in black.
  color: { ...COLOR, splash: SUNNY, splashMark: '#000000' },
};

/** A saved theme that no longer exists falls back to Default. */
/**
 * Outlines for streak days and badges still to come. The soft themes' border colour is a pale tint that
 * vanishes on their tinted cards, so they use the faint text colour instead.
 */
export function ringColor(colors: ThemeColors): string {
  return colors.sticker ? colors.textTertiary : colors.borderStrong;
}

export function resolveThemeColors(theme: AppTheme): ThemeColors {
  return Themes[theme] ?? Themes.default;
}

export const THEME_META: { key: AppTheme; label: string; swatch: string }[] = [
  // Amethyst is what every new couple starts on.
  { key: 'amethyst', label: 'Amethyst', swatch: '#9333EA' },
  { key: 'violet', label: 'Ultraviolet', swatch: VIOLET },
  { key: 'default', label: 'Buttercup', swatch: BUTTER },
  { key: 'dark', label: 'Midnight', swatch: '#000000' },
  { key: 'night', label: 'Starlight', swatch: NIGHT_BLUE },
  { key: 'blue', label: 'Ocean', swatch: '#3B82F6' },
  { key: 'coral', label: 'Sunset', swatch: CORAL },
  { key: 'cream', label: 'Honey', swatch: '#FFF1DF' },
  { key: 'paper', label: 'Ink', swatch: Themes.paper.background },
  { key: 'color', label: 'Pop', swatch: SUNNY },
];

/** Empty slots that fill the theme grid's last row (3 a row), so no tile stretches to fill it. */
export const THEME_GRID_FILLERS = Array.from({ length: (3 - (THEME_META.length % 3)) % 3 }, (_, i) => `filler-${i}`);

export const MOOD_EMOJI: Record<string, string> = {
  happy: '😊',
  excited: '🤩',
  calm: '😌',
  stressed: '😰',
  lonely: '🥺',
  loved: '🥰',
  grateful: '🙏',
  tired: '😴',
  anxious: '😬',
  sad: '😢',
  angry: '😤',
  playful: '😜',
  hopeful: '✨',
  funny: '😂',
  flirty: '😏',
  sexy: '🔥',
  spicy: '🌶️',
  romantic: '💕',
  silly: '🤪',
  heartbroken: '💔',
  crying: '😭',
  hurt: '🩹',
  emotional: '🥹',
  missing: '💭',
};

export const MOOD_LABELS: Record<string, string> = {
  happy: 'Happy',
  excited: 'Excited',
  calm: 'Calm',
  stressed: 'Stressed',
  lonely: 'Lonely',
  loved: 'Loved',
  grateful: 'Grateful',
  tired: 'Tired',
  anxious: 'Anxious',
  sad: 'Sad',
  angry: 'Angry',
  playful: 'Playful',
  hopeful: 'Hopeful',
  funny: 'Funny',
  flirty: 'Flirty',
  sexy: 'Sexy',
  spicy: 'Spicy',
  romantic: 'Romantic',
  silly: 'Silly',
  heartbroken: 'Heartbroken',
  crying: 'Crying',
  hurt: 'Hurt',
  emotional: 'Emotional',
  missing: 'Missing you',
};

export const MOOD_COLORS: Record<string, string> = {
  happy: '#FFC75F',
  excited: '#FF8E72',
  calm: '#6FD3C7',
  stressed: '#E5777A',
  lonely: '#9DB0FF',
  loved: '#FF8FAB',
  grateful: '#7BC47F',
  tired: '#A8B4C4',
  anxious: '#C9A0FF',
  sad: '#7EB6FF',
  angry: '#FF6B6B',
  playful: '#FFD166',
  hopeful: '#86E3CE',
  funny: '#FFB347',
  flirty: '#FF7EB6',
  sexy: '#E84A5F',
  spicy: '#FF4D4D',
  romantic: '#FF6B9D',
  silly: '#B388FF',
  heartbroken: '#C44D58',
  crying: '#6B9BD1',
  hurt: '#D98686',
  emotional: '#9DB0FF',
  missing: '#8896B8',
};

export const REACTION_EMOJI = ['❤️', '😂', '😢', '😍', '🔥', '👍'] as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const FREE_DAILY_MOMENTS = 5;
export const FREE_AI_REQUESTS = 3;
export const FREE_TIMELINE_MOMENTS = 12;
/** Free tier shared album storage (100 MB). Plus is unlimited. */
export const FREE_ALBUM_STORAGE_BYTES = 100 * 1024 * 1024;
