import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppTheme } from '@/constants/design-system';

const THEME_KEY = 'moments_theme';

export async function saveTheme(theme: AppTheme) {
  await AsyncStorage.setItem(THEME_KEY, theme);
}

export async function getSavedTheme(): Promise<AppTheme | null> {
  const value = await AsyncStorage.getItem(THEME_KEY);
  if (value === 'black' || value === 'paper' || value === 'crimson') return value;
  return null;
}
