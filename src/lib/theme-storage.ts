import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppTheme } from '@/constants/design-system';

const THEME_KEY = 'moments_theme';

export async function saveTheme(theme: AppTheme) {
  await AsyncStorage.setItem(THEME_KEY, theme);
}

export async function getSavedTheme(): Promise<AppTheme | null> {
  const value = await AsyncStorage.getItem(THEME_KEY);
  // Older names: Black is now Dark; the short-lived Light is Default.
  if (value === 'black') return 'dark';
  if (value === 'light') return 'default';
  if (value === 'default' || value === 'dark' || value === 'night' || value === 'violet' || value === 'blue' || value === 'coral' || value === 'cream' || value === 'paper' || value === 'color') return value;
  return null;
}
