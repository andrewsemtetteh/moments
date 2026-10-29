import * as Haptics from '@/lib/haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CONTENT_MAX_WIDTH } from '@/lib/layout';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import Svg, { Path } from 'react-native-svg';

import { colorWithAlpha, primaryButtonEdge } from '@/components/ui/primitives';
import { Radius, Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
// Used by the commented-out dev previews:
// import { useAuthStore } from '@/stores';
// import { designPass } from '@/lib/onboarding-v2';

// All three free under the Lottie Simple License (commercial use permitted,
// attribution optional) via LottieFiles: "Couple sharing and caring love" by
// Abdul Latif, "Cosy Autumn couple with falling leaves" by Lisa Paton, and
// "Marriage Couple hugging" by Boltbite — all three in the same flat 2D
// vector illustration style, and all three about couples rather than any one
// of them being an off-brand icon or 3D render.
const SLIDES = [
  {
    kind: 'lottie' as const,
    animation: require('@/assets/lottie/couple-together.json'),
    title: ['Stay close on ', 'busy days', '.'],
    body: 'Share a moment and stay part of each other’s day.',
    // Native 1:1 art fills the box edge-to-edge, unlike the others' framing
    // with breathing room — scaled down slightly so it doesn't read oversized.
    scale: 0.86,
  },
  {
    kind: 'lottie' as const,
    animation: require('@/assets/lottie/couple-daily.json'),
    title: ['Go ', 'deeper', ' than small talk.'],
    body: 'A question a day, cards and games that spark real conversations.',
    scale: 1,
  },
  {
    kind: 'lottie' as const,
    animation: require('@/assets/lottie/couple-hug.json'),
    title: ['A space just for ', 'you two', '.'],
    body: 'Photos, chats and memories, private and in one place.',
    scale: 1,
  },
];

const SLIDE_DURATION_MS = 5000;
const FADE_DURATION_MS = 420;
const SWIPE_THRESHOLD = 48;
const ARC_HEIGHT = 36;
// Baseline width (standard iPhone portrait) that the type scale was tuned
// against — smaller/larger devices scale proportionally from here.
const BASE_WIDTH = 390;

function StoryBars({ count, active, color }: { count: number; active: number; color: string }) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = 0;
    fill.value = withTiming(1, { duration: SLIDE_DURATION_MS, easing: Easing.linear });
  }, [active, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View style={styles.bars} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: count, now: active + 1 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.bar, { backgroundColor: colorWithAlpha(color, 0.14) }]}>
          {i < active ? <View style={[styles.barFill, { width: '100%', backgroundColor: color }]} /> : null}
          {i === active ? <Animated.View style={[styles.barFill, { backgroundColor: color }, fillStyle]} /> : null}
        </View>
      ))}
    </View>
  );
}

export default function AuthWelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The page column's width (capped on tablets / unfolded phones), live.
  const { width: screenW, height } = useWindowDimensions();
  const width = Math.min(screenW, CONTENT_MAX_WIDTH);
  // Device-level appearance (AsyncStorage), loaded before sign-in too — so this
  // follows whatever the person already picked, not a theme locked to one option.
  const { colors } = useTheme();

  const [activeIndex, setActiveIndex] = useState(0);

  // One opacity per slide, all mounted simultaneously and cross-faded by
  // animating them in opposite directions at once — the illustration (and its
  // copy) is never fully hidden between slides, unlike an unmount/remount fade.
  const opacity0 = useSharedValue(1);
  const opacity1 = useSharedValue(0);
  const opacity2 = useSharedValue(0);
  const slideOpacities = [opacity0, opacity1, opacity2];
  const style0 = useAnimatedStyle(() => ({ opacity: opacity0.value }));
  const style1 = useAnimatedStyle(() => ({ opacity: opacity1.value }));
  const style2 = useAnimatedStyle(() => ({ opacity: opacity2.value }));
  const slideStyles = [style0, style1, style2];

  const applyFade = (from: number, to: number) => {
    slideOpacities[from].value = withTiming(0, { duration: FADE_DURATION_MS });
    slideOpacities[to].value = withTiming(1, { duration: FADE_DURATION_MS });
  };
  // Takes a fixed target rather than "+1" so it's safe to call from a one-off
  // gesture callback — the interval below instead computes its own next
  // index from the updater's fresh `i` each tick, since a target captured
  // once at setInterval-creation time would otherwise go stale.
  const crossFadeTo = (next: number) => {
    setActiveIndex((i) => {
      if (next === i) return i;
      applyFade(i, next);
      return next;
    });
  };
  const goNext = () => crossFadeTo((activeIndex + 1) % SLIDES.length);
  const goPrev = () => crossFadeTo((activeIndex - 1 + SLIDES.length) % SLIDES.length);

  // Auto-advance. Keyed on activeIndex (not just mount) so it restarts its
  // countdown from zero on every change — including a manual swipe — instead
  // of a timer tick already mid-flight immediately undoing that swipe. Ref
  // access stays inside this effect rather than in goNext/goPrev/the gesture
  // handlers below, since those are read during render to build the gesture.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActiveIndex((i) => {
        const next = (i + 1) % SLIDES.length;
        applyFade(i, next);
        return next;
      });
    }, SLIDE_DURATION_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // slideOpacities holds stable shared-value refs — safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const handleSwipeNext = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goNext();
  };
  const handleSwipePrev = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goPrev();
  };

  // Only claims the gesture past a real horizontal drag, so taps on the "Get
  // started" button underneath still reach it untouched.
  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) runOnJS(handleSwipeNext)();
      else if (e.translationX > SWIPE_THRESHOLD) runOnJS(handleSwipePrev)();
    });

  const handleGetStarted = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/get-started');
  };

  /* Dev-only previews (their buttons are commented out below):
  // Dev-only escape hatch to look at the tab screens without a real sign-in —
  // `__DEV__` is a compile-time constant, so this branch (and the button
  // below) is stripped out of release/production bundles entirely, not just
  // hidden. No real session exists afterward, so anything that needs actual
  // user/relationship data (most of the app) will sit empty or error — this
  // is for eyeballing layout only, never a real account.
  const handleDevPreview = () => {
    if (!__DEV__) return;
    void Haptics.selectionAsync();
    useAuthStore.setState({ session: true, isLoading: false });
    router.replace('/(tabs)/home');
  };

  // Dev-only: tap through sign-up and the whole onboarding without an account.
  const handleDesignPass = () => {
    if (!__DEV__) return;
    void Haptics.selectionAsync();
    designPass.on = true;
    router.push('/(auth)/get-started');
  };
  */

  const bottomInset = Math.max(insets.bottom, Spacing.lg);

  const contentOpacity = useSharedValue(0);
  const contentY = useSharedValue(14);

  useEffect(() => {
    contentOpacity.value = withTiming(1, { duration: 480 });
    contentY.value = withTiming(0, { duration: 520 });
  }, [contentOpacity, contentY]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentY.value }],
  }));

  // Type scale follows the device's actual width/height rather than fixed
  // pixel values, clamped so it never gets illegibly small or comically large.
  const typeScale = Math.min(Math.max(width / BASE_WIDTH, 0.88), 1.2);
  // Shorter than before — the longer body copy below needs the room, and the
  // illustration no longer needs to fit entirely inside this zone (it's
  // allowed to run low and get cropped by the arc, see illustrationLayer).
  const illustrationZoneHeight = height * 0.5;
  // Driven mainly by width now rather than boxed in by the zone's height —
  // sized close to a real close-up crop (like the reference), with its lower
  // portion intentionally bleeding behind the arc rather than shrunk to fit
  // above it. illustrationZone clips anything that runs past its own edges.
  const illustrationSize = Math.min(width * 1.02, 440);
  // One shared width for every line of text AND the button below, so they
  // all share the same left/right edge instead of each picking its own
  // padding — capped on tablets/large screens instead of stretching edge to
  // edge like a phone.
  const textColumnWidth = Math.min(width - 56, 400);

  // Dome bulging up into the illustration zone, filled with the text zone's own
  // color — the "arc cut" that separates the two without a hard line. Lives
  // entirely within the zone's own bottom edge (0 <= y <= ARC_HEIGHT), so the
  // curve's peak at y=0 never gets clipped by the SVG's own bounds.
  const arcPath = `M0,${ARC_HEIGHT} Q${width / 2},0 ${width},${ARC_HEIGHT} Z`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <GestureDetector gesture={swipe}>
        <Animated.View style={[styles.content, contentStyle]}>
          <View
            style={[
              styles.illustrationZone,
              { height: illustrationZoneHeight, backgroundColor: colors.accentMuted },
            ]}>
            <View style={styles.illustrationCenter}>
              {SLIDES.map((slide, i) => {
                const size = illustrationSize * (slide.scale ?? 1);
                return (
                  <Animated.View
                    key={i}
                    style={[StyleSheet.absoluteFill, styles.illustrationLayer, slideStyles[i]]}>
                    <LottieView
                      source={slide.animation}
                      autoPlay
                      loop
                      resizeMode="contain"
                      style={{ width: size, height: size }}
                    />
                  </Animated.View>
                );
              })}
            </View>

            <Svg width={width} height={ARC_HEIGHT} style={styles.arc} pointerEvents="none">
              <Path d={arcPath} fill={colors.background} />
            </Svg>
          </View>

          <SafeAreaView style={styles.textZone} edges={['left', 'right']}>
            <View style={[styles.textColumn, { width: textColumnWidth }]}>
              <View style={styles.copyWrap}>
                {SLIDES.map((slide, i) => (
                  <Animated.View
                    key={i}
                    style={[StyleSheet.absoluteFill, styles.copyLayer, slideStyles[i]]}>
                    <Text
                      style={[
                        styles.title,
                        { color: colors.text, fontSize: 34 * typeScale, lineHeight: 38 * typeScale },
                      ]}>
                      {slide.title[0]}
                      {/* One word in the logo's coral carries the slide's idea. */}
                      <Text style={styles.titleAccent}>{slide.title[1]}</Text>
                      {slide.title[2]}
                    </Text>
                    <Text
                      style={[
                        styles.body,
                        { color: colors.textSecondary, fontSize: 16 * typeScale, lineHeight: 22 * typeScale },
                      ]}
                      numberOfLines={2}>
                      {slide.body}
                    </Text>
                  </Animated.View>
                ))}
              </View>

              <View style={styles.bottomCluster}>
                {/* Story-style bars: the current one fills over the slide's time. */}
                <StoryBars count={SLIDES.length} active={activeIndex} color={colors.text} />

                <View style={{ paddingBottom: bottomInset + Spacing.sm, gap: Spacing.sm }}>
                  <Pressable
                    onPress={handleGetStarted}
                    style={({ pressed }) => [
                      styles.primaryCta,
                      { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
                      primaryButtonEdge(colors),
                    ]}>
                    <Text
                      style={[
                        styles.primaryCtaText,
                        { color: colors.onAccent, fontSize: 17 * typeScale },
                      ]}>
                      Get started
                    </Text>
                  </Pressable>


                  {/* Dev-only previews, removed from the page (bring back for testing):
                  {__DEV__ && (
                    <Pressable
                      onPress={handleDevPreview}
                      hitSlop={8}
                      style={({ pressed }) => [styles.devPreview, { opacity: pressed ? 0.6 : 1 }]}>
                      <Text style={[styles.devPreviewText, { color: colors.textSecondary }]}>
                        Preview UI (dev only, no sign-in)
                      </Text>
                    </Pressable>
                  )}
                  {__DEV__ && (
                    <Pressable
                      onPress={handleDesignPass}
                      hitSlop={8}
                      style={({ pressed }) => [styles.devPreview, { opacity: pressed ? 0.6 : 1 }]}>
                      <Text style={[styles.devPreviewText, { color: colors.textSecondary }]}>
                        Design pass: sign-up and onboarding (dev only)
                      </Text>
                    </Pressable>
                  )}
                  */}
                </View>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  illustrationZone: {
    width: '100%',
    // The illustration is deliberately oversized and anchored low (see
    // illustrationLayer) so it reads as a close, cropped portrait rather than
    // a small floating figure — this clips that overflow to the zone itself
    // instead of letting it bleed into the text below.
    overflow: 'hidden',
  },
  illustrationCenter: {
    flex: 1,
    width: '100%',
  },
  illustrationLayer: {
    alignItems: 'center',
    // Anchored low enough that the art's own lower portion runs behind the
    // arc and gets cropped by it — an intentional close-up, not a bug — while
    // still clearing the curve's flat baseline so nothing floats above it.
    justifyContent: 'flex-end',
    paddingBottom: ARC_HEIGHT * 0.3,
  },
  arc: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  // Centers its one child (textColumn) horizontally — the column itself
  // carries the actual responsive width, so every line of text and the
  // button below share one consistent edge instead of nested paddings
  // drifting out of alignment with each other.
  textZone: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  textColumn: {
    flex: 1,
  },
  // flex:1 gives this a height derived from the space wordmark/bottomCluster
  // don't use — overflow:'hidden' clips rather than overlapping the dots
  // below if a slide's copy ever runs slightly taller than that space.
  copyWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  copyLayer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  // Big, heavy display type (Hinge / Headspace style), tight tracking.
  title: {
    fontWeight: '900',
    letterSpacing: -1.2,
    textAlign: 'center',
  },
  // The logo's coral, the same on every theme.
  titleAccent: { color: '#FF4D6D' },
  body: {
    fontWeight: '500',
    textAlign: 'center',
  },
  // Extra paddingTop (vs. the copy's own internal gaps) keeps a clear gap
  // above the dots even when a slide's 3-line body runs to its full length.
  bottomCluster: {
    width: '100%',
    gap: Spacing.lg + 4,
    paddingTop: Spacing.xl,
  },
  bars: { flexDirection: 'row', gap: 6, alignSelf: 'center', width: 120 },
  bar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  primaryCta: {
    minHeight: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryCtaText: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  devPreview: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  devPreviewText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
