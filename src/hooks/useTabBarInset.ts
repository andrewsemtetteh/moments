import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_CONTENT_GAP, getTabBarScrollInset } from '@/components/layout/tab-bar-layout';
import { useUIStore } from '@/stores';

/** Minimum bottom clearance — tab bar + FAB + safe area + breathing room. */
const MIN_TAB_BAR_INSET = 220;

export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  const measuredOverlay = useUIStore((s) => s.tabBarOverlayHeight);

  return useMemo(() => {
    if (measuredOverlay > 0) {
      return measuredOverlay + TAB_BAR_CONTENT_GAP;
    }
    return Math.max(getTabBarScrollInset(insets.bottom), MIN_TAB_BAR_INSET);
  }, [measuredOverlay, insets.bottom]);
}
