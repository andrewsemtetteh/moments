import { useMemo } from 'react';

import { Themes, resolveThemeColors, type AppTheme } from '@/constants/design-system';
import { useUIStore } from '@/stores';

export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const colors = useMemo(() => resolveThemeColors(theme), [theme]);

  return { theme, setTheme, colors };
}

export function useThemeColors(themeOverride?: AppTheme) {
  const theme = useUIStore((s) => s.theme);
  return useMemo(() => resolveThemeColors(themeOverride ?? theme), [theme, themeOverride]);
}
