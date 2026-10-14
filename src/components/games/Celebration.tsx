import * as Haptics from '@/lib/haptics';
import { memo, useEffect, useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  FadeOutUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { useGameRoomStore } from '@/stores/game-room-store';
import { usePlayProgressStore, type Celebration } from '@/stores/play-progress-store';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CONFETTI_COLORS = ['#FF6B8A', '#FFD54A', '#5B8DEF', '#3DBE7A', '#B48CFF', '#FF9F5A'];

function Piece({ index, count }: { index: number; count: number }) {
  const t = useSharedValue(0);
  const spec = useMemo(() => {
    const angle = (index / count) * Math.PI * 2 + Math.random() * 0.6;
    const speed = 160 + Math.random() * 260;
    return {
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed - 140,
      spin: (Math.random() - 0.5) * 900,
      size: 7 + Math.random() * 7,
      delay: Math.random() * 120,
      round: Math.random() > 0.5,
    };
  }, [index, count]);

  useEffect(() => {
    t.value = withDelay(spec.delay, withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }));
  }, [t, spec.delay]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.7 ? 1 : (1 - t.value) / 0.3,
    transform: [
      { translateX: spec.dx * t.value },
      { translateY: spec.dy * t.value + 380 * t.value * t.value },
      { rotate: `${spec.spin * t.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          backgroundColor: spec.color,
          width: spec.size,
          height: spec.round ? spec.size : spec.size * 1.8,
          borderRadius: spec.round ? spec.size / 2 : 2,
        },
        style,
      ]}
    />
  );
}

/** One-shot burst of confetti from the middle of the screen. Remount (change `burstKey`) to replay. */
export const Confetti = memo(function Confetti({ count = 46, burstKey = 0 }: { count?: number; burstKey?: number }) {
  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [burstKey]);
  return (
    <View pointerEvents="none" style={styles.confettiRoot} key={burstKey}>
      {Array.from({ length: count }).map((_, i) => (
        <Piece key={i} index={i} count={count} />
      ))}
    </View>
  );
});

const AUTO_DISMISS_MS = 3400;

function Toast({ item }: { item: Celebration }) {
  const { colors } = useTheme();
  const dismiss = usePlayProgressStore((s) => s.dismissCelebration);

  useEffect(() => {
    const id = setTimeout(() => dismiss(item.id), item.kind === 'xp' ? 2200 : AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [item, dismiss]);

  const { emoji, title, sub } = useMemo(() => {
    switch (item.kind) {
      case 'xp':
        return { emoji: '⭐', title: `+${item.amount} XP`, sub: item.label };
      case 'quest':
        return { emoji: item.quest.emoji, title: 'Quest complete!', sub: `${item.quest.title} · +${item.quest.reward} XP` };
      case 'badge':
        return { emoji: item.badge.emoji, title: `Badge: ${item.badge.title}`, sub: item.badge.hint };
      case 'level':
        return { emoji: '🎉', title: `Level ${item.level}!`, sub: item.title };
    }
  }, [item]);

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(14)}
      exiting={FadeOutUp.duration(200)}
      style={[
        styles.toast,
        { backgroundColor: colors.surfaceElevated, borderColor: item.kind === 'xp' ? colors.border : colors.accent },
      ]}>
      <Text style={styles.toastEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toastTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.toastSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </Animated.View>
  );
}

function LevelUp({ item }: { item: Extract<Celebration, { kind: 'level' }> }) {
  const { colors } = useTheme();
  const dismiss = usePlayProgressStore((s) => s.dismissCelebration);
  useEffect(() => {
    const id = setTimeout(() => dismiss(item.id), 4200);
    return () => clearTimeout(id);
  }, [item, dismiss]);

  return (
    <Pressable style={styles.levelRoot} onPress={() => dismiss(item.id)} accessibilityLabel="Dismiss level up">
      <Confetti burstKey={item.level} />
      <Animated.View
        entering={ZoomIn.springify().damping(11)}
        style={[styles.levelCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.accent }]}>
        <Text style={styles.levelEmoji}>🏅</Text>
        <Text style={[styles.levelKicker, { color: colors.accent }]}>LEVEL UP</Text>
        <Text style={[styles.levelNumber, { color: colors.text }]}>{item.level}</Text>
        <Text style={[styles.levelTitle, { color: colors.textSecondary }]}>{item.title}</Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Shows XP / quest / badge toasts and the level-up card from the shared celebration queue.
 * Rendered in one place at a time: inside the live room while it's open (so it can't be hidden
 * under the room's native modal), otherwise at the app root.
 */
export function CelebrationHost({ surface }: { surface: 'root' | 'room' }) {
  const roomOpen = useGameRoomStore((s) => s.open);
  const queue = usePlayProgressStore((s) => s.celebrations);
  const insets = useSafeAreaInsets();
  if ((surface === 'root') === roomOpen) return null;

  const level = queue.find((c): c is Extract<Celebration, { kind: 'level' }> => c.kind === 'level');
  const toasts = queue.filter((c) => c.kind !== 'level').slice(0, 3);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={[styles.toastStack, { top: insets.top + 8 }]}>
        {toasts.map((item) => (
          <Toast key={item.id} item={item} />
        ))}
      </View>
      {level ? <LevelUp key={level.id} item={level} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  confettiRoot: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  piece: { position: 'absolute', top: SCREEN_H * 0.34, left: SCREEN_W / 2 },
  toastStack: { position: 'absolute', top: 64, left: 16, right: 16, gap: 8 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  toastEmoji: { fontSize: 28 },
  toastTitle: { fontSize: 16, fontWeight: '900' },
  toastSub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  levelRoot: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  levelCard: { borderRadius: 32, borderWidth: 2, paddingVertical: 28, paddingHorizontal: 44, alignItems: 'center', gap: 2 },
  levelEmoji: { fontSize: 54 },
  levelKicker: { fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  levelNumber: { fontSize: 72, fontWeight: '900', lineHeight: 80 },
  levelTitle: { fontSize: 16, fontWeight: '800' },
});
