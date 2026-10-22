import { useWindowDimensions } from 'react-native';

/**
 * Pages read best at phone width. On tablets and unfolded phones (Galaxy Fold, Surface
 * Duo, split screen) the content stays in a centred column this wide instead of
 * stretching across the screen.
 */
export const CONTENT_MAX_WIDTH = 600;

/** The page column's width right now: the screen's, up to CONTENT_MAX_WIDTH. Live (folds, rotation). */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return Math.min(width, CONTENT_MAX_WIDTH);
}

/** A big screen (tablet, unfolded phone): wider than a phone in portrait. */
export function useIsWideScreen(): boolean {
  return useWindowDimensions().width >= 700;
}
