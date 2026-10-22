import * as Haptics from '@/lib/haptics';
import { router, usePathname, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { Avatar, outlineColor } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { type IslandEvent, subscribeIsland } from '@/lib/in-app-notify';
import { openFromNotification } from '@/lib/notification-navigation';
import { useAuthStore } from '@/stores';

/** How long one island stays fully open (readable) before it tucks back up. */
const ISLAND_MS = 5000;
/** About how long the opening spring takes: the 5 seconds count from when it's fully open. */
const OPEN_SETTLE_MS = 600;
/** The real Dynamic Island (iPhone 14 Pro and later): it grows out of this. */
const ISLAND_W = 126;
const ISLAND_H = 37;
/** Opened: a black card (one line of message), a little taller per extra line. */
const CARD_H = 66;
const LINE_H = 18;
/** Concise: the message never runs past two lines. */
const MAX_LINES = 2;
const CARD_RADIUS = 24;
const CARD_MAX_W = 380;
/** A soft spring, like the system's: it grows out of the island, no wobble or goo. */
const OPEN = { damping: 22, stiffness: 240, mass: 0.9 };
const CLOSE = { duration: 220, easing: Easing.in(Easing.cubic) };

type Shown = IslandEvent & { key: number; height: number };

/** When the open island tucks back up (there's only ever one island). */
let closeTimer: ReturnType<typeof setTimeout> | null = null;
function clearCloseTimer() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = null;
}

/** One line fits the base card; it grows a line at a time (up to three) for a longer message. */
function heightFor(message: string | undefined, width: number): number {
  if (!message) return CARD_H - 8;
  // Avatar, gaps, the icon on the right and padding take ~118pt; ~6.9pt a character.
  const perLine = Math.max(18, Math.floor((width - 118) / 6.9));
  const lines = Math.min(MAX_LINES, Math.ceil(message.length / perLine));
  return CARD_H + (lines - 1) * LINE_H;
}

/**
 * In-app notifications the Dynamic Island way: on iPhones with the island, a black pill
 * grows straight out of it into a card (avatar, who, the message in full, the kind of
 * notification), then tucks back in. Elsewhere the same card drops from the top. Tap to
 * open, swipe up to put it away. Only once you're signed in and past onboarding, and
 * never for the screen you're already on.
 */
export function DynamicIslandHost({ children }: { children: ReactNode }) {
  return (
    <View style={styles.flex}>
      {children}
      <Island />
    </View>
  );
}

function Island() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const pathname = usePathname();
  const segments = useSegments();
  const signedIn = useAuthStore((s) => !!s.user);
  const settingUp = segments[0] === '(auth)' || segments[0] === '(onboarding)' || pathname === '/pro';
  const allowed = signedIn && !settingUp;

  const cardW = Math.min(width - 24, CARD_MAX_W);
  // iPhones with the Dynamic Island have a tall top inset (54+); there it grows from the island.
  const hasIsland = Platform.OS === 'ios' && insets.top >= 51;
  const top = hasIsland ? Math.max(insets.top - 48, 8) : insets.top + 6;

  const [shown, setShown] = useState<Shown | null>(null);
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pathRef = useRef(pathname);
  const allowedRef = useRef(allowed);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    pathRef.current = pathname;
    allowedRef.current = allowed;
  }, [pathname, allowed]);

  const clear = useCallback(() => setShown(null), []);
  const hide = useCallback(() => {
    clearCloseTimer();
    progress.set(
      withTiming(0, CLOSE, (done) => {
        if (done) runOnJS(clear)();
      }),
    );
  }, [progress, clear]);

  useEffect(
    () =>
      subscribeIsland((event) => {
        if (event.id) {
          if (seen.current.has(event.id)) return;
          seen.current.add(event.id);
        }
        if (!allowedRef.current) return;
        if (event.hideOn?.(pathRef.current)) return;
        if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShown({ ...event, key: Date.now(), height: heightFor(event.message, cardW) });
        dragY.set(0);
        progress.set(withSpring(1, OPEN));
        clearCloseTimer();
        // Fully open for the whole 5 seconds (the opening itself doesn't eat into it).
        closeTimer = setTimeout(hide, OPEN_SETTLE_MS + (event.duration ?? ISLAND_MS));
      }),
    [cardW, hide, progress, dragY],
  );
  useEffect(() => clearCloseTimer, []);
  // Signed out (or into setup screens): put it away.
  useEffect(() => {
    if (!allowed && shown) hide();
  }, [allowed, shown, hide]);

  const open = useCallback(() => {
    const target = shown?.target;
    hide();
    if (target) void openFromNotification(target, router);
  }, [shown, hide]);

  const gesture = useMemo(() => {
    const swipeUp = Gesture.Pan()
      .activeOffsetY([-8, 8])
      .onUpdate((e) => {
        dragY.set(Math.min(0, e.translationY));
      })
      .onEnd((e) => {
        if (e.translationY < -24 || e.velocityY < -500) runOnJS(hide)();
        else dragY.set(withSpring(0, OPEN));
      });
    const tap = Gesture.Tap().onEnd((_e, ok) => {
      if (ok) runOnJS(open)();
    });
    return Gesture.Exclusive(swipeUp, tap);
  }, [dragY, hide, open]);

  const h = shown?.height ?? CARD_H;
  const startW = hasIsland ? ISLAND_W : 120;
  const startH = hasIsland ? ISLAND_H : 36;
  // Theme-aware: it leaves the island black (so it grows out of it) and turns into the
  // theme's card colour as it opens; on phones without an island it's the card colour throughout.
  const cardColor = colors.isDark ? colors.surface : colors.surfaceElevated;
  const border = outlineColor(colors);
  const cardStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      backgroundColor: hasIsland ? interpolateColor(p, [0, 0.6], ['#000000', cardColor]) : cardColor,
      borderColor: hasIsland ? interpolateColor(p, [0, 0.6], ['#000000', border]) : border,
      width: interpolate(p, [0, 1], [startW, cardW]),
      height: interpolate(p, [0, 1], [startH, h]),
      borderRadius: interpolate(p, [0, 1], [startH / 2, CARD_RADIUS]),
      // Without an island it fades in as it drops; with one it's always there (the island).
      opacity: hasIsland ? 1 : interpolate(p, [0, 0.3], [0, 1], 'clamp'),
      transform: [{ translateY: dragY.value + (hasIsland ? 0 : interpolate(p, [0, 1], [-12, 0])) }],
    };
  });
  // The content only once it has room (as the island's content does).
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.55, 1], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(progress.value, [0.55, 1], [0.94, 1], 'clamp') }],
  }));

  if (!shown) return null;
  return (
    <View pointerEvents="box-none" style={[styles.layer, { top }]}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.card, cardStyle]} accessibilityRole="alert">
          <Animated.View style={[styles.row, contentStyle]}>
            {shown.avatar || shown.avatarName ? (
              <Avatar name={shown.avatarName} imageUrl={shown.avatar} size={38} />
            ) : (
              <View style={[styles.kind, styles.kindLead, { backgroundColor: colors.accent }]}>
                <Icon name={shown.icon ?? 'bell'} size={18} color={colors.onAccent} />
              </View>
            )}
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {shown.title}
              </Text>
              {shown.message ? (
                <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={MAX_LINES}>
                  {shown.message}
                </Text>
              ) : null}
            </View>
            {shown.icon && (shown.avatar || shown.avatarName) ? (
              <View style={[styles.kind, { backgroundColor: colors.accent }]}>
                <Icon name={shown.icon} size={15} color={colors.onAccent} />
              </View>
            ) : null}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 2000, elevation: 2000 },
  // Colours come from the theme (see cardStyle); outlined like the trophy shelf cards.
  card: {
    overflow: 'hidden',
    borderCurve: 'continuous',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 10 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  message: { fontSize: 13.5, lineHeight: LINE_H, fontWeight: '500', marginTop: 1 },
  kind: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  kindLead: { width: 38, height: 38, borderRadius: 19 },
});
