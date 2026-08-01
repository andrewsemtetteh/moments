/** Layout math for the floating tab bar + center FAB. */
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_FLOAT_GAP = 16;
export const TAB_BAR_FAB_OVERFLOW = 40;
/** Extra visible gap between last content and the tab bar. */
export const TAB_BAR_CONTENT_GAP = 40;
export const TAB_BAR_SCROLL_BUFFER = 24;

export function getTabBarBottomPadding(safeAreaBottom: number): number {
  return Math.max(safeAreaBottom, 12) + TAB_BAR_FLOAT_GAP;
}

export function getTabBarScrollInset(safeAreaBottom: number): number {
  return (
    TAB_BAR_HEIGHT +
    TAB_BAR_FAB_OVERFLOW +
    getTabBarBottomPadding(safeAreaBottom) +
    TAB_BAR_CONTENT_GAP +
    TAB_BAR_SCROLL_BUFFER
  );
}
