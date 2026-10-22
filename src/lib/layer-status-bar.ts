import { StatusBar, type StatusBarProps } from 'react-native';

import { resolveThemeColors } from '@/constants/design-system';
import { isFullScreenLayerOpen, useUIStore } from '@/stores';

/**
 * A native Modal (Moments, an album, the partner's profile, the map, Plus…) takes a copy of the
 * status bar's colours at the moment it opens, and keeps it: opened from Home's coloured header,
 * Moments got light icons on a light page (the clock and battery vanished). So while a
 * full-screen layer is open, the theme's own colours sit on top of the status bar's stack; when
 * the last one closes they come off, and the page underneath (Home) is back to its own.
 *
 * (Setting the colour directly instead left Home stuck with the layer's colours afterwards:
 * the stack never knew it had changed, so it didn't put Home's back.)
 */
let started = false;
let entry: StatusBarProps | null = null;

export function startLayerStatusBarSync() {
  if (started) return;
  started = true;
  useUIStore.subscribe((state, prev) => {
    const open = isFullScreenLayerOpen(state);
    const wasOpen = isFullScreenLayerOpen(prev);
    if (open && !wasOpen) {
      const barStyle = resolveThemeColors(state.theme).isDark ? 'light-content' : 'dark-content';
      // Straight away, so the layer opens with it…
      StatusBar.setBarStyle(barStyle, false);
      // …and on the stack, so taking it off later restores the page's own.
      if (!entry) entry = StatusBar.pushStackEntry({ barStyle, hidden: false });
    } else if (!open && wasOpen && entry) {
      StatusBar.popStackEntry(entry);
      entry = null;
    }
  });
}
