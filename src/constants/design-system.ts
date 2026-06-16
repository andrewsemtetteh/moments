export type AppTheme = 'dark' | 'black' | 'light' | 'forest' | 'glass' | 'deep_blue';

export interface ThemeColors {
  /** Identity */
  isDark: boolean;
  glass: boolean;
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
  dark: {
    isDark: true,
    glass: false,
    background: '#0B0B0F',
    backgroundElevated: '#121218',
    surface: '#16161D',
    surfaceElevated: '#1E1E28',
    surfaceGlass: 'rgba(255,255,255,0.06)',
    text: '#F6F6F8',
    textSecondary: '#A0A0AD',
    textTertiary: '#6B6B78',
    onAccent: '#FFFFFF',
    accent: '#FF6B8A',
    accentSoft: 'rgba(255,107,138,0.14)',
    accentMuted: '#3A1F28',
    gradient: ['#FF6B8A', '#FF8E72'],
    gradientHero: ['#0B0B0F', '#121218', '#0B0B0F'],
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    success: '#46C98B',
    warning: '#E5B567',
    error: '#FF5C6C',
    chatBubbleSelf: '#FF6B8A',
    chatBubblePartner: '#1E1E28',
    chatBackground: '#121218',
    chatBubbleSelfText: '#FFFFFF',
    chatReadReceipt: '#53BDEB',
    shadow: '#000000',
  },
  black: {
    isDark: true,
    glass: false,
    background: '#000000',
    backgroundElevated: '#050505',
    surface: '#0A0A0A',
    surfaceElevated: '#121212',
    surfaceGlass: 'rgba(255,255,255,0.06)',
    text: '#FFFFFF',
    textSecondary: '#A3A3A3',
    textTertiary: '#6B6B6B',
    onAccent: '#FFFFFF',
    accent: '#FF6B8A',
    accentSoft: 'rgba(255,107,138,0.14)',
    accentMuted: '#2A1218',
    gradient: ['#FF6B8A', '#FF8E72'],
    gradientHero: ['#000000', '#050505', '#000000'],
    border: 'rgba(255,255,255,0.10)',
    borderStrong: 'rgba(255,255,255,0.18)',
    success: '#46C98B',
    warning: '#E5B567',
    error: '#FF5C6C',
    chatBubbleSelf: '#FF6B8A',
    chatBubblePartner: '#121212',
    chatBackground: '#050505',
    chatBubbleSelfText: '#FFFFFF',
    chatReadReceipt: '#53BDEB',
    shadow: '#000000',
  },
  light: {
    isDark: false,
    glass: false,
    background: '#FFFFFF',
    backgroundElevated: '#FAFAFB',
    surface: '#F5F5F7',
    surfaceElevated: '#FFFFFF',
    surfaceGlass: 'rgba(0,0,0,0.04)',
    text: '#141418',
    textSecondary: '#5E5E68',
    textTertiary: '#9A9AA5',
    onAccent: '#FFFFFF',
    accent: '#E5577A',
    accentSoft: 'rgba(229,87,122,0.10)',
    accentMuted: '#FBE4EB',
    gradient: ['#FF7A98', '#FF9E84'],
    gradientHero: ['#FFFFFF', '#FAFAFB', '#FFFFFF'],
    border: 'rgba(0,0,0,0.08)',
    borderStrong: 'rgba(0,0,0,0.14)',
    success: '#2E9E6B',
    warning: '#C99A3E',
    error: '#E0414F',
    chatBubbleSelf: '#DCF8C6',
    chatBubblePartner: '#FFFFFF',
    chatBackground: '#ECE5DD',
    chatBubbleSelfText: '#0A0A0A',
    chatReadReceipt: '#53BDEB',
    shadow: '#5A5A6B',
  },
  forest: {
    isDark: true,
    glass: false,
    background: '#0A130E',
    backgroundElevated: '#0F1C15',
    surface: '#13251B',
    surfaceElevated: '#1B3326',
    surfaceGlass: 'rgba(110,255,190,0.06)',
    text: '#EAF5EE',
    textSecondary: '#94B5A2',
    textTertiary: '#5E7D6C',
    onAccent: '#04130B',
    accent: '#46D6A0',
    accentSoft: 'rgba(70,214,160,0.14)',
    accentMuted: '#10362A',
    gradient: ['#46D6A0', '#3FA7C4'],
    gradientHero: ['#0A130E', '#0F1C15', '#0A130E'],
    border: 'rgba(150,255,210,0.08)',
    borderStrong: 'rgba(150,255,210,0.16)',
    success: '#46D6A0',
    warning: '#D9BE6A',
    error: '#FF6B6B',
    chatBubbleSelf: '#46D6A0',
    chatBubblePartner: '#1B3326',
    chatBackground: '#0F1C15',
    chatBubbleSelfText: '#04130B',
    chatReadReceipt: '#53BDEB',
    shadow: '#000000',
  },
  glass: {
    isDark: false,
    glass: true,
    background: '#E6ECF4',
    backgroundElevated: '#DFE6F0',
    surface: 'rgba(255,255,255,0.48)',
    surfaceElevated: 'rgba(255,255,255,0.62)',
    surfaceGlass: 'rgba(255,255,255,0.74)',
    text: '#141824',
    textSecondary: '#4E5568',
    textTertiary: '#7A8294',
    onAccent: '#FFFFFF',
    accent: '#E5577A',
    accentSoft: 'rgba(229,87,122,0.14)',
    accentMuted: 'rgba(229,87,122,0.08)',
    gradient: ['#FFB8D0', '#B8C8FF'],
    gradientHero: ['#F5EFFA', '#EAF2FF', '#FFF0F5'],
    border: 'rgba(255,255,255,0.55)',
    borderStrong: 'rgba(255,255,255,0.88)',
    success: '#2E9E6B',
    warning: '#C99A3E',
    error: '#E0414F',
    chatBubbleSelf: 'rgba(255,255,255,0.84)',
    chatBubblePartner: 'rgba(255,255,255,0.50)',
    chatBackground: '#E6ECF4',
    chatBubbleSelfText: '#141824',
    chatReadReceipt: '#53BDEB',
    shadow: '#9AA3B8',
  },
  deep_blue: {
    isDark: true,
    glass: false,
    background: '#070C1C',
    backgroundElevated: '#0C1530',
    surface: '#101B3C',
    surfaceElevated: '#162449',
    surfaceGlass: 'rgba(120,160,255,0.06)',
    text: '#EAF0FF',
    textSecondary: '#94A3CC',
    textTertiary: '#5E6E99',
    onAccent: '#FFFFFF',
    accent: '#5680FF',
    accentSoft: 'rgba(86,128,255,0.16)',
    accentMuted: '#142250',
    gradient: ['#5680FF', '#6FB7FF'],
    gradientHero: ['#070C1C', '#0C1530', '#070C1C'],
    border: 'rgba(140,170,255,0.10)',
    borderStrong: 'rgba(140,170,255,0.20)',
    success: '#46C98B',
    warning: '#E5B567',
    error: '#FF5C6C',
    chatBubbleSelf: '#5680FF',
    chatBubblePartner: '#162449',
    chatBackground: '#0A1024',
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
  { key: 'black', label: 'Black', swatch: Themes.black.background },
  { key: 'dark', label: 'Charcoal', swatch: Themes.dark.background },
  { key: 'light', label: 'White', swatch: Themes.light.background },
  { key: 'forest', label: 'Dark Green', swatch: Themes.forest.background },
  { key: 'glass', label: 'Glassy', swatch: '#EEF2F8' },
  { key: 'deep_blue', label: 'Deep Blue', swatch: Themes.deep_blue.background },
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
export const FREE_JOURNAL_ENTRIES = 50;
export const FREE_TIMELINE_MOMENTS = 12;
