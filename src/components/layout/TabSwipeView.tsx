import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { openChat } from '@/lib/router';
import {
  adjacentVisibleTab,
  consumePendingSwipeDirection,
  setPendingSwipeDirection,
  visibleTabFromPath,
  visibleTabHref,
  type VisibleTab,
} from '@/lib/tab-navigation';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_DRAG = SCREEN_WIDTH * 0.28;
const SWIPE_THRESHOLD = 56;
const SWIPE_VELOCITY = 420;
const RESET_MS = 140;
const EXIT_MS = 200;
const ENTER_MS = 240;

function clampDrag(value: number) {
  'worklet';
  return Math.max(-MAX_DRAG, Math.min(MAX_DRAG, value));
}

function rubberBand(value: number, blocked: boolean) {
  'worklet';
  if (!blocked) return value;
  return value * 0.18;
}

function useTabSwipePan(enabled: boolean) {
  const router = useRouter();
  const pathname = usePathname();

  // Consumed exactly once per mount (before first paint) so the incoming
  // screen starts already off-screen on the swiped-from edge — animating it
  // in from there, instead of flashing at 0 first, is what makes the tab
  // switch read as one continuous slide rather than a cut.
  const enterDirectionRef = useRef<'next' | 'prev' | null | undefined>(undefined);
  if (enterDirectionRef.current === undefined) {
    enterDirectionRef.current = consumePendingSwipeDirection();
  }
  const initialTranslate =
    enterDirectionRef.current === 'next'
      ? SCREEN_WIDTH
      : enterDirectionRef.current === 'prev'
        ? -SCREEN_WIDTH
        : 0;

  const translateX = useSharedValue(initialTranslate);
  const canGoNext = useSharedValue(0);
  const canGoPrev = useSharedValue(0);

  const currentTab = visibleTabFromPath(pathname);

  useEffect(() => {
    translateX.value = withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });

    if (!currentTab) {
      canGoNext.value = 0;
      canGoPrev.value = 0;
      return;
    }

    const hasNext = adjacentVisibleTab(currentTab, 'next') != null;
    const hasPrev = adjacentVisibleTab(currentTab, 'prev') != null;

    canGoNext.value = hasNext ? 1 : 0;
    canGoPrev.value = currentTab === 'home' || hasPrev ? 1 : 0;
  }, [currentTab, canGoNext, canGoPrev, translateX]);

  const goToTab = useCallback(
    (tab: VisibleTab, direction: 'next' | 'prev') => {
      void Haptics.selectionAsync();
      setPendingSwipeDirection(direction);
      router.navigate(visibleTabHref(tab));
    },
    [router],
  );

  const goNext = useCallback(() => {
    if (!currentTab) return;
    const next = adjacentVisibleTab(currentTab, 'next');
    if (next) goToTab(next, 'next');
  }, [currentTab, goToTab]);

  const goPrev = useCallback(() => {
    if (!currentTab) return;
    if (currentTab === 'home') {
      void Haptics.selectionAsync();
      openChat();
      return;
    }
    const prev = adjacentVisibleTab(currentTab, 'prev');
    if (prev) goToTab(prev, 'prev');
  }, [currentTab, goToTab]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled && currentTab != null)
        // Only claim clear horizontal swipes — vertical scroll keeps the gesture
        .activeOffsetX([-36, 36])
        .failOffsetY([-10, 10])
        .onUpdate((event) => {
          let tx = event.translationX;

          if (tx < 0) {
            tx = canGoNext.value === 1 ? clampDrag(tx) : rubberBand(tx, true);
          } else if (tx > 0) {
            tx = canGoPrev.value === 1 ? clampDrag(tx) : rubberBand(tx, true);
          }

          translateX.value = tx;
        })
        .onEnd((event) => {
          const swipedNext =
            canGoNext.value === 1 &&
            (event.translationX < -SWIPE_THRESHOLD || event.velocityX < -SWIPE_VELOCITY);
          const swipedPrev =
            canGoPrev.value === 1 &&
            (event.translationX > SWIPE_THRESHOLD || event.velocityX > SWIPE_VELOCITY);

          if (swipedNext) {
            translateX.value = withTiming(
              -SCREEN_WIDTH,
              { duration: EXIT_MS, easing: Easing.out(Easing.cubic) },
              (finished) => {
                if (finished) runOnJS(goNext)();
              },
            );
            return;
          }

          if (swipedPrev) {
            translateX.value = withTiming(
              SCREEN_WIDTH,
              { duration: EXIT_MS, easing: Easing.out(Easing.cubic) },
              (finished) => {
                if (finished) runOnJS(goPrev)();
              },
            );
            return;
          }

          translateX.value = withTiming(0, {
            duration: RESET_MS,
            easing: Easing.out(Easing.cubic),
          });
        }),
    [canGoNext, canGoPrev, currentTab, enabled, goNext, goPrev, translateX],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return { pan, animatedStyle };
}

interface TabSwipeViewProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
}

/**
 * Tab bar order (left → right): Home · Play · Plan · You
 * - Swipe left  → next tab
 * - Swipe right → previous tab; on Home → chat
 */
export function TabSwipeView({ children, style, enabled = true }: TabSwipeViewProps) {
  const { pan, animatedStyle } = useTabSwipePan(enabled);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}
