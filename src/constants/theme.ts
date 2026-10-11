/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#2B1B16',
    background: '#FBF3EC',
    backgroundElement: '#F3E4D8',
    backgroundSelected: '#F0D8C6',
    textSecondary: 'rgba(43,27,22,0.68)',
    textTertiary: 'rgba(43,27,22,0.46)',
    border: 'rgba(43,27,22,0.1)',
    accent: '#A83E52',
    accentSecondary: '#C97B3C',
    spark: '#FF6452',
    onAccent: '#FFFFFF',
    shadow: '#3D2A22',
    gradient: ['#FBF3EC', '#F6E1CE'] as [string, string],
  },
  dark: {
    text: '#F7ECE4',
    background: '#1C1310',
    backgroundElement: '#241A15',
    backgroundSelected: '#2E211A',
    textSecondary: 'rgba(247,236,228,0.68)',
    textTertiary: 'rgba(247,236,228,0.46)',
    border: 'rgba(247,236,228,0.12)',
    accent: '#F0A090',
    accentSecondary: '#E0A868',
    spark: '#FF8A6E',
    onAccent: '#1C1310',
    shadow: '#000000',
    gradient: ['#1C1310', '#241A15'] as [string, string],
  },
} as const;

/** Scalar color tokens only — `gradient` is a tuple and isn't a valid single color value. */
export type ThemeColor = Exclude<keyof typeof Colors.light & keyof typeof Colors.dark, 'gradient'>;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  seven: 96,
} as const;

export const Radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 1120;
/** Comfortable reading width for headlines and body copy inside the wider page shell. */
export const TextContentWidth = 640;
/** Space to clear the floating web nav pill, which overlays the page rather than pushing it down. */
export const WebNavClearance = 108;
