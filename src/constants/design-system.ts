export type AppTheme = 'black' | 'paper' | 'crimson';

export interface ThemeColors {
  /** Identity */
  isDark: boolean;
  glass: boolean;
  /** Bold outlined cards/buttons instead of the usual hairline border (e.g. `paper`). */
  boldBorder?: boolean;
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
  /** Gradients */
  gradient: [string, string];
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
  /** Shadow */
  shadow: string;
}

export const Themes: Record<AppTheme, ThemeColors> = {
  /** True-black canvas with warm (not cold-gray) elevation. */
  black: {
    isDark: true,
    glass: false,
    background: '#000000',
    backgroundElevated: '#000000',
    // Apple's iOS dark-mode secondary/tertiary system values, warmed a few degrees
    // so cards and sheets don't read as cold slate against the coral accent below.
    surface: '#1C1714',
    surfaceElevated: '#2A2119',
    surfaceGlass: 'rgba(255,255,255,0.06)',
    // Warm cream rather than clinical pure white — softer and more intimate
    // against true black.
    text: '#F7ECE4',
    textSecondary: 'rgba(247,236,228,0.68)',
    textTertiary: 'rgba(247,236,228,0.46)',
    onAccent: '#14100D',
    accent: '#F0A090',
    accentSoft: 'rgba(240,160,144,0.16)',
    accentMuted: '#382420',
    gradient: ['#F0A090', '#F6BDAE'],
    // A whisper of ember warmth in the middle stop instead of flat black — depth
    // without breaking the true-black canvas.
    gradientHero: ['#000000', '#180F0B', '#000000'],
    border: 'rgba(247,236,228,0.14)',
    borderStrong: 'rgba(247,236,228,0.26)',
    success: '#5ACB8F',
    warning: '#E5B567',
    error: '#FF6B6B',
    chatBubbleSelf: '#F0A090',
    chatBubblePartner: '#2A2119',
    chatBackground: '#000000',
    chatBubbleSelfText: '#14100D',
    chatReadReceipt: '#53BDEB',
    shadow: '#000000',
  },
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
  },
  /** Deep wine canvas with a crimson accent and a rose-gold second stop — same
   * rich, saturated feel as a jewel-tone reference, reskinned from purple to red. */
  crimson: {
    isDark: true,
    glass: false,
    background: '#1A0E11',
    backgroundElevated: '#241217',
    surface: '#2E161C',
    surfaceElevated: '#3B1C22',
    surfaceGlass: 'rgba(255,255,255,0.06)',
    text: '#F7E8E7',
    textSecondary: 'rgba(247,232,231,0.68)',
    textTertiary: 'rgba(247,232,231,0.46)',
    onAccent: '#FFFFFF',
    accent: '#E6395A',
    accentSoft: 'rgba(230,57,90,0.16)',
    accentMuted: '#4A1E26',
    // Red into rose-gold, not red into pink — keeps the duotone warm rather than candy-sweet.
    gradient: ['#E6395A', '#E8A15E'],
    gradientHero: ['#1A0E11', '#241217', '#1A0E11'],
    border: 'rgba(247,232,231,0.12)',
    borderStrong: 'rgba(247,232,231,0.22)',
    success: '#5ACB8F',
    warning: '#E5B567',
    error: '#FF6B6B',
    chatBubbleSelf: '#E6395A',
    chatBubblePartner: '#3B1C22',
    chatBackground: '#1A0E11',
    chatBubbleSelfText: '#FFFFFF',
    chatReadReceipt: '#53BDEB',
    shadow: '#000000',
  },
};

/** Screen backdrop gradient — glass keeps its pastel mesh; others anchor to background. */
export function resolveThemeColors(theme: AppTheme): ThemeColors {
  const base = Themes[theme];
  if (base.glass) return base;
  return {
    ...base,
    gradientHero: [base.background, base.backgroundElevated, base.background],
  };
}

export const THEME_META: { key: AppTheme; label: string; swatch: string }[] = [
  { key: 'paper', label: 'Paper', swatch: Themes.paper.background },
  { key: 'black', label: 'Black', swatch: Themes.black.background },
  { key: 'crimson', label: 'Crimson', swatch: Themes.crimson.accent },
];

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
