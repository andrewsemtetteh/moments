export const VISIBLE_TAB_ORDER = ['home', 'activities', 'calendar', 'profile'] as const;

export type VisibleTab = (typeof VISIBLE_TAB_ORDER)[number];

export function visibleTabFromPath(pathname: string): VisibleTab | null {
  if (pathname.includes('/chat') || pathname.includes('/notifications')) return null;
  if (pathname.includes('/activities')) return 'activities';
  if (pathname.includes('/calendar')) return 'calendar';
  if (pathname.includes('/profile')) return 'profile';
  if (pathname.includes('/home') || pathname.endsWith('/(tabs)')) return 'home';
  return null;
}

export function adjacentVisibleTab(
  tab: VisibleTab,
  direction: 'next' | 'prev',
): VisibleTab | null {
  const index = VISIBLE_TAB_ORDER.indexOf(tab);
  if (index < 0) return null;
  if (direction === 'next') return VISIBLE_TAB_ORDER[index + 1] ?? null;
  return VISIBLE_TAB_ORDER[index - 1] ?? null;
}

export function visibleTabHref(tab: VisibleTab) {
  return `/(tabs)/${tab}` as const;
}
