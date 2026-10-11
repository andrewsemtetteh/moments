export const VISIBLE_TAB_ORDER = ['home', 'activities', 'profile'] as const;

export type VisibleTab = (typeof VISIBLE_TAB_ORDER)[number];

export function visibleTabHref(tab: VisibleTab) {
  return `/(tabs)/${tab}` as const;
}
