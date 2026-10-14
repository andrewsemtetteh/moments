import * as Haptics from '@/lib/haptics';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg';

import { measureTourTarget, type TourRect } from '@/components/layout/TourTarget';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { consumeTourPending } from '@/lib/onboarding-v2';
import { useAuthStore, useUIStore } from '@/stores';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
/** Room around the spotlighted thing, and its corner rounding. */
const PAD = 8;
const RADIUS = 22;
const ARROW = 10;
const CARD_GAP = 14;

type Step = {
  /** The TourTarget it points at. */
  target: string;
  icon: IconName;
  title: string;
  body: string;
  action?: { label: string; run: () => void };
};

/**
 * The tour right after onboarding, the way real apps do coach marks: the
 * screen dims, a rounded spotlight opens on the exact thing being explained,
 * and a tooltip with an arrow points at it. Tap anywhere (or Next) to move on;
 * Skip any time; shown once. If a target isn't on screen, the tip just sits
 * in the middle without a spotlight.
 */
export function OnboardingTour() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  // The spotlight for the step it was measured for (stale until the new one lands).
  const [spot, setSpot] = useState<{ index: number; rect: TourRect | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void consumeTourPending(userId).then((pending) => {
        if (!cancelled && pending) setVisible(true);
      });
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId]);

  const close = useCallback(() => {
    setVisible(false);
    setIndex(0);
    setSpot(null);
  }, []);

  const steps: Step[] = [
    {
      target: 'tour-space',
      icon: 'heart',
      title: 'This is your space',
      body: 'Your person shows up here the moment they join. Show up together every day to grow your streak.',
    },
    {
      target: 'tour-today',
      icon: 'question',
      title: 'Check in every day',
      body: 'Tap how you’re feeling and answer today’s question. You’ll see each other’s answer once you’ve both replied.',
    },
    {
      target: 'tour-camera',
      icon: 'camera',
      title: 'Send your first moment',
      body: 'A photo or a short video of right now. It’s the first thing your person sees when they open Moments.',
      action: {
        label: 'Open camera',
        run: () => {
          close();
          setTimeout(() => setShowMomentCreator(true), 250);
        },
      },
    },
    {
      target: 'tour-tabs',
      icon: 'compass',
      title: 'Getting around',
      body: 'Home, Play and You live down here. Swipe right from Home for Together: your plans and memories.',
    },
  ];
  const step = steps[index];
  const last = index === steps.length - 1;

  // Find the step's target on screen each time the step changes.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const at = index;
    void measureTourTarget(steps[at].target).then((r) => {
      if (!alive) return;
      const onScreen = r && r.y < SCREEN_H - 40 && r.y + r.height > 40;
      setSpot({ index: at, rect: onScreen ? r : null });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, index]);

  const next = () => {
    void Haptics.selectionAsync();
    if (last) close();
    else setIndex(index + 1);
  };

  if (!visible || spot?.index !== index) return null;
  const rect = spot.rect;

  // Spotlight hole, a little bigger than the thing itself.
  const hole = rect
    ? {
        x: Math.max(6, rect.x - PAD),
        y: rect.y - PAD,
        w: Math.min(SCREEN_W - 12, rect.width + PAD * 2),
        h: rect.height + PAD * 2,
      }
    : null;

  // Tooltip goes below the spotlight if there's room, otherwise above it.
  const roomBelow = hole ? SCREEN_H - (hole.y + hole.h) - insets.bottom : 0;
  const below = hole ? roomBelow > 230 : true;
  const cardPos = hole
    ? below
      ? { top: hole.y + hole.h + ARROW + CARD_GAP }
      : { bottom: SCREEN_H - hole.y + ARROW + CARD_GAP }
    : { top: SCREEN_H * 0.32 };
  // Arrow lines up with the middle of the target, kept inside the card's corners.
  const arrowX = hole ? Math.min(SCREEN_W - 16 - 34, Math.max(16 + 22, hole.x + hole.w / 2)) - 16 - ARROW : 0;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      {/* Dim everything except the spotlight; tapping it moves on. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={next} accessibilityLabel="Next tip">
        <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
          <Svg width={SCREEN_W} height={SCREEN_H}>
            <Defs>
              <Mask id="spotlight">
                <Rect x={0} y={0} width={SCREEN_W} height={SCREEN_H} fill="#fff" />
                {hole ? <Rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={RADIUS} fill="#000" /> : null}
              </Mask>
            </Defs>
            <Rect x={0} y={0} width={SCREEN_W} height={SCREEN_H} fill="rgba(8,8,14,0.72)" mask="url(#spotlight)" />
          </Svg>
        </Animated.View>
        {hole ? (
          // A soft ring around the spotlight so it reads as "this one".
          <Animated.View
            key={`ring-${index}`}
            entering={ZoomIn.duration(260)}
            pointerEvents="none"
            style={[
              styles.ring,
              { left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderColor: colors.accent },
            ]}
          />
        ) : null}
      </Pressable>

      <Animated.View
        key={`card-${index}`}
        entering={(below ? FadeInDown : FadeInUp).duration(300)}
        style={[styles.card, cardPos, { backgroundColor: colors.background, borderColor: colors.text }]}>
        {hole ? (
          <Svg
            width={ARROW * 2}
            height={ARROW + 2}
            style={[styles.arrow, below ? { top: -ARROW - 1 } : { bottom: -ARROW - 1, transform: [{ rotate: '180deg' }] }, { left: arrowX }]}>
            <Path
              d={`M0 ${ARROW + 1} L${ARROW} 1 L${ARROW * 2} ${ARROW + 1}`}
              fill={colors.background}
              stroke={colors.text}
              strokeWidth={2}
            />
          </Svg>
        ) : null}
        <View style={styles.head}>
          <View style={[styles.tile, { backgroundColor: colors.accent }]}>
            <Icon name={step.icon} size={18} color={colors.onAccent} />
          </View>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {step.title}
          </Text>
        </View>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{step.body}</Text>
        <View style={styles.row}>
          <View style={styles.dots}>
            {steps.map((s, i) => (
              <View
                key={s.title}
                style={[styles.dot, { backgroundColor: i === index ? colors.text : colors.border, width: i === index ? 18 : 6 }]}
              />
            ))}
          </View>
          <View style={styles.buttons}>
            {!last ? (
              <Pressable onPress={close} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.skip, { color: colors.textSecondary }]}>Skip</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                if (step.action) step.action.run();
                else next();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.next, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
              <Text style={[styles.nextText, { color: colors.onAccent }]}>
                {step.action?.label ?? (last ? 'Got it' : 'Next')}
              </Text>
            </Pressable>
          </View>
        </View>
        {step.action ? (
          <Pressable onPress={next} hitSlop={8} style={styles.later} accessibilityRole="button">
            <Text style={[styles.skip, { color: colors.textSecondary }]}>Later</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderRadius: RADIUS, borderWidth: 2.5 },
  card: { position: 'absolute', left: 16, right: 16, borderRadius: 22, borderWidth: 2, padding: 16, gap: 8 },
  arrow: { position: 'absolute' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tile: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { height: 6, borderRadius: 3 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  skip: { fontSize: 14, fontWeight: '700' },
  next: { height: 42, paddingHorizontal: 20, borderRadius: 21, justifyContent: 'center' },
  nextText: { fontSize: 15, fontWeight: '800' },
  later: { alignSelf: 'flex-end' },
});
