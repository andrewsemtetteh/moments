import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from '@/lib/haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StickerFlame } from '@/components/home/StickerFlame';
import { Icon } from '@/components/ui/Icon';
import { Radius } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { localCalendarDate } from '@/lib/db-time';
import { streakWellColors } from '@/lib/streak-colors';
import { formatTimeLeft, msUntilLocalMidnight, showStreakEndsTonightCard } from '@/lib/streak-reminder-timing';
import type { StreakStatus } from '@/types/database';

const CLOSED_KEY = 'moments_streak_risk_card_closed';

/**
 * Home, from the evening, before you've checked in: two short lines, like Duolingo's
 * "streak in danger" (the count, and the time left). A freeze you hold is mentioned,
 * since it would save the day. The ✕ hides it until tomorrow.
 */
export function StreakAtRiskBanner({
  status,
  now: fixedNow,
  preview = false,
}: {
  status: StreakStatus;
  /** Settings › Developer: show it as at this time. */
  now?: Date;
  preview?: boolean;
}) {
  const { colors } = useTheme();
  const well = streakWellColors('risk', colors);
  // The countdown ticks every 30 seconds.
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (fixedNow) return;
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [fixedNow]);
  const now = fixedNow ?? new Date(tick);
  const today = localCalendarDate(now);
  // Closed today (remembered on this phone); the preview's ✕ only hides it there and then.
  const [closedOn, setClosedOn] = useState<string | null>(null);
  useEffect(() => {
    if (preview) return;
    void AsyncStorage.getItem(CLOSED_KEY)
      .then(setClosedOn)
      .catch(() => undefined);
  }, [preview]);

  if (closedOn === today || !showStreakEndsTonightCard(status, now)) return null;
  const freezes = status.streak_freezes ?? 0;

  const close = () => {
    void Haptics.selectionAsync();
    setClosedOn(today);
    if (!preview) void AsyncStorage.setItem(CLOSED_KEY, today).catch(() => undefined);
  };

  return (
    <View style={[styles.card, { backgroundColor: well.cardBg, borderColor: well.cardBorder }]} accessibilityRole="alert">
      <View style={[styles.well, { backgroundColor: well.well }]}>
        <StickerFlame size={22} animated />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{status.current_streak}-day streak at risk</Text>
        <Text style={[styles.sub, { color: well.label }]}>
          {formatTimeLeft(msUntilLocalMidnight(now))} left{freezes ? ` · ${freezes} freeze ready` : ''}
        </Text>
      </View>
      <Pressable
        onPress={close}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
        <Icon name="close" size={24} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
  },
  well: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 13, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
