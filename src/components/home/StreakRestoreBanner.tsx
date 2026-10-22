import * as Haptics from '@/lib/haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { StickerFlame } from '@/components/home/StickerFlame';
import { Icon } from '@/components/ui/Icon';
import { Radius } from '@/constants/design-system';
import { useRestoreStreak } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useTheme } from '@/hooks/useTheme';
import { isStreakRestoreAvailable, streakRestoreMsLeft } from '@/lib/streak';
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


/**
 * Home, after a streak was lost (for 24 hours): the flame gone out, two short lines (what
 * was lost, the time left) and a restore button, like Duolingo's streak repair. The whole
 * card is the button: with Plus it restores, on Free it opens the paywall.
 */
export function StreakRestoreBanner({ status, preview = false, now = new Date() }: StreakRestoreBannerProps) {
  const { colors } = useTheme();
  const { isPlus, requirePlus } = usePlusGate();
  const restoreStreak = useRestoreStreak();

  if (!isStreakRestoreAvailable(status, now)) return null;

  const count = status.restorable_streak ?? 0;
  const left = formatTimeLeft(streakRestoreMsLeft(status, now));
  const pending = restoreStreak.isPending;

  const handleRestore = () => {
    if (pending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (preview) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    if (isPlus) {
      restoreStreak.mutate();
      return;
    }
    requirePlus('Streak restore');
  };

  return (
    <Pressable
      onPress={handleRestore}
      disabled={pending}
      accessibilityRole="button"
      accessibilityLabel={isPlus ? `Restore your ${count}-day streak` : `Restore your ${count}-day streak with Moments Plus`}
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
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{left} left to restore</Text>
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
