import * as Haptics from '@/lib/haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { StickerFlame } from '@/components/home/StickerFlame';
import { Icon } from '@/components/ui/Icon';
import { Radius } from '@/constants/design-system';
import { useRestoreStreak } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useTheme } from '@/hooks/useTheme';
import { usePurchasesStore } from '@/lib/purchases';
import {
  isStreakRestoreAvailable,
  isStreakRestoreFirstDay,
  isStreakRestoreFree,
  streakRestoreFreeMsLeft,
  streakRestoreMsLeft,
} from '@/lib/streak';
import { formatTimeLeft } from '@/lib/streak-reminder-timing';
import { STREAK_COLORS } from '@/lib/streak-colors';
import type { StreakStatus } from '@/types/database';

interface StreakRestoreBannerProps {
  status: StreakStatus;
  /** Settings › Developer preview: Restore only gives feedback (nothing real to restore). */
  preview?: boolean;
  /** Settings › Developer: show it as at this time. */
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "3 days left", or on the last day "5h 20m left". */
function leftLabel(ms: number): string {
  if (ms >= DAY_MS) {
    const days = Math.ceil(ms / DAY_MS);
    return `${days} days left`;
  }
  return `${formatTimeLeft(ms)} left`;
}

/**
 * Home (and the streak page), for 5 days after a streak was lost: the flame gone out, what was
 * lost, what restoring costs and the time left, like Duolingo's streak repair. The whole card is
 * the button. Free with Plus on the day it was lost; otherwise a $0.99 restore (a paid one you
 * already hold is used first). Free users on day one choose: $0.99 now, or Plus (free restores).
 */
export function StreakRestoreBanner({ status, preview = false, now: fixedNow }: StreakRestoreBannerProps) {
  const { colors } = useTheme();
  const { isPlus, requirePlus } = usePlusGate();
  const restoreStreak = useRestoreStreak();
  const price = usePurchasesStore((s) => s.restorePrice) ?? '$0.99';
  // The time left ticks every 30 seconds, and the card goes when the restore days are over.
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (fixedNow) return;
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [fixedNow]);
  const now = fixedNow ?? new Date(tick);

  if (!isStreakRestoreAvailable(status, now)) return null;

  const count = status.restorable_streak ?? 0;
  const free = isStreakRestoreFree(status, now);
  const credits = status.restore_credits ?? 0;
  // Started a new streak since: restoring joins the two.
  const joined = status.current_streak > 0 ? count + status.current_streak : null;
  const cost = free ? 'Free with Plus' : credits > 0 ? 'Restore ready' : `${price} to restore`;
  const left = leftLabel(free ? streakRestoreFreeMsLeft(status, now) : streakRestoreMsLeft(status, now));
  const sub = [joined ? `Makes it ${joined} days` : null, cost, left].filter(Boolean).join(' · ');
  const pending = restoreStreak.isPending;

  const buy = () => restoreStreak.mutate({ pay: true });

  /** No free restore and none held: day one on Free offers Plus too; after that, just the $0.99. */
  const offerPurchase = () => {
    if (isStreakRestoreFirstDay(status, now) && !isPlus) {
      Alert.alert(`Restore your ${count}-day streak`, `Restore it now for ${price}, or get Plus and restore it free today.`, [
        { text: `Restore for ${price}`, onPress: buy },
        { text: 'Get Plus', onPress: () => requirePlus('Streak restore') },
        { text: 'Not now', style: 'cancel' },
      ]);
      return;
    }
    buy();
  };

  const handleRestore = () => {
    if (pending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (preview) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    if (free || credits > 0) {
      // The server has the last word (the free day may just have ended): offer the purchase if so.
      restoreStreak.mutate(
        { pay: false },
        { onSuccess: ({ outcome }) => (outcome === 'needs_purchase' ? offerPurchase() : undefined) },
      );
      return;
    }
    offerPurchase();
  };

  return (
    <Pressable
      onPress={handleRestore}
      disabled={pending}
      accessibilityRole="button"
      accessibilityLabel={`Restore your ${count}-day streak. ${sub}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: colors.boldBorder ? 2 : 1 },
        pressed && styles.pressed,
      ]}>
      {/* The flame gone out, on a solid grey sticker (as clear as the at-risk card's). */}
      <View style={[styles.well, styles.lostWell, { backgroundColor: colors.isDark ? '#3A3836' : '#ECEAE6' }]}>
        <StickerFlame size={24} variant="out" />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{count}-day streak lost</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      {/* Just the icon: the card says what it does. */}
      {/* The streak's own orange (relighting it), a touch brighter on dark themes. */}
      <View style={[styles.cta, { backgroundColor: colors.isDark ? STREAK_COLORS.activeBright : STREAK_COLORS.active }]}>
        {pending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="restore" size={22} color="#FFFFFF" filled />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.lg,
    padding: 12,
  },
  well: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lostWell: { borderWidth: 2, borderColor: '#000000' },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 13, fontWeight: '600' },
  cta: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
});
