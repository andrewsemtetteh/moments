import * as Haptics from '@/lib/haptics';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StickerFlame } from '@/components/home/StickerFlame';
import { ShareCardModal } from '@/components/share/ShareCardModal';
import { StreakShareCard } from '@/components/share/StreakShareCard';
import { Icon } from '@/components/ui/Icon';
import { useStreak } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { buildMilestoneWeek, type StreakDayCell } from '@/lib/streak-days';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { ThemedStatusBar } from '@/components/ui/ThemedStatusBar';

const LIT = '#FFE7A0';
const DAY = 40;
/** When things land, in ms after opening (matches the design board). */
const NUMBER_AT = 640;
const TODAY_AT = 1000;
const TEXT_AT = 1150;

type Props = {
  count: number;
  /** Yesterday's count; the number rolls up from it. */
  fromCount: number;
  /** A milestone (7, 30, 50, 100…): its own headline instead of "day streak". */
  headline?: string;
  /** The line under the title. */
  message: string;
  onClose: () => void;
};

/**
 * The streak celebration (daily and milestones), in the onboarding style:
 * the sticker flame ignites, the number rolls up, today's circle lights,
 * then the message, Continue and "Share achievement" (a shareable card).
 */
export function StreakCelebration({ count, fromCount, headline, message, onClose }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const { data: streak } = useStreak();
  const [shown, setShown] = useState(reduceMotion ? count : fromCount);
  const [todayLit, setTodayLit] = useState(reduceMotion);
  const [sharing, setSharing] = useState(false);

  const week = useMemo(
    () => buildMilestoneWeek(count, relationship?.created_at, streak ?? null),
    [count, relationship?.created_at, streak],
  );
  const names = `${getFirstName(user?.name) ?? 'Me'} & ${getFirstName(partner?.name) ?? 'my person'}`;

  // The number: yesterday's rolls up and away, today's rolls in with a bounce.
  const roll = useSharedValue(0);
  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduceMotion) return;
    roll.value = withDelay(NUMBER_AT - 160, withTiming(-1, { duration: 160, easing: Easing.in(Easing.quad) }));
    const t1 = setTimeout(() => {
      setShown(count);
      roll.value = 1;
      roll.value = withSpring(0, { damping: 11, stiffness: 220 });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, NUMBER_AT);
    const t2 = setTimeout(() => {
      setTodayLit(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, TODAY_AT);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // Plays once per celebration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const numberStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.abs(roll.value)),
    transform: [{ translateY: roll.value * 46 }],
  }));

  const close = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };
  const enter = (delay: number) => (reduceMotion ? undefined : FadeInUp.delay(delay).duration(400));

  return (
    <Modal visible animationType="fade" onRequestClose={close} statusBarTranslucent presentationStyle="fullScreen">
      <ThemedStatusBar />
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.content} edges={['top', 'bottom']}>
          <View style={styles.main}>
            {/* On top of everything while it ignites, so nothing covers it. */}
            <View style={styles.flame}>
              <StickerFlame size={156} face animated ignite />
            </View>
            <View style={styles.numberBox}>
              <Animated.Text style={[styles.number, { color: colors.text }, numberStyle]}>{shown.toLocaleString()}</Animated.Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {headline ?? 'day streak'}
            </Text>
            <Animated.Text entering={enter(TEXT_AT)} style={[styles.message, { color: colors.textSecondary }]}>
              {message}
            </Animated.Text>
          </View>

          <View style={styles.bottom}>
            <View style={[styles.weekCard, { borderColor: colors.text }]}>
              <View style={styles.weekRow}>
                {week.map((d) => (
                  <Text
                    key={`l-${d.date.toISOString()}`}
                    style={[styles.weekday, { color: d.isToday ? colors.text : colors.textSecondary }, d.isToday && styles.weekdayToday]}>
                    {d.weekdayLabel.charAt(0)}
                  </Text>
                ))}
              </View>
              <View style={styles.weekRow}>
                {week.map((d) => (
                  <View key={d.date.toISOString()} style={styles.cell}>
                    <DayDot
                      day={d}
                      todayLit={todayLit}
                      ink={colors.text}
                      ring={colors.borderStrong}
                      fill={colors.surface}
                      label={colors.textSecondary}
                    />
                  </View>
                ))}
              </View>
            </View>

            <Animated.View entering={enter(TEXT_AT + 150)} style={styles.actions}>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                style={({ pressed }) => [styles.cta, { backgroundColor: colors.text }, pressed && styles.pressed]}>
                <Text style={[styles.ctaText, { color: colors.background }]}>Continue</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSharing(true);
                }}
                accessibilityRole="button"
                hitSlop={6}
                style={({ pressed }) => [styles.share, pressed && styles.pressed]}>
                <Icon name="share" size={18} color={colors.text} />
                <Text style={[styles.shareText, { color: colors.text }]}>Share achievement</Text>
              </Pressable>
            </Animated.View>
          </View>
        </SafeAreaView>

        {/* Inside this popup, so it sits on top of the celebration. */}
        <ShareCardModal visible={sharing} onClose={() => setSharing(false)} title="Share your streak" inline>
          <StreakShareCard count={count} names={names} headline={headline} />
        </ShareCardModal>
      </View>
    </Modal>
  );
}

/** A day in the week row: lit (sticker flame), today waiting (dashed), a past day (ring + date) or one to come (faint dashes). */
function DayDot({
  day,
  todayLit,
  ink,
  ring,
  fill,
  label,
}: {
  day: StreakDayCell;
  todayLit: boolean;
  ink: string;
  ring: string;
  fill: string;
  label: string;
}) {
  const lit = day.isToday ? todayLit : day.state === 'completed' || day.state === 'today-done';
  const pop = useSharedValue(1);
  useEffect(() => {
    if (day.isToday && todayLit) {
      pop.value = 0.6;
      pop.value = withSequence(withTiming(1.14, { duration: 260 }), withSpring(1, { damping: 9, stiffness: 220 }));
    }
  }, [day.isToday, todayLit, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  if (lit) {
    return (
      <Animated.View
        style={[styles.dot, { backgroundColor: LIT, borderColor: ink, borderWidth: day.isToday ? 3 : 2 }, day.isToday && popStyle]}>
        <StickerFlame size={20} />
      </Animated.View>
    );
  }
  if (day.isToday) {
    return (
      <View style={[styles.dot, styles.dashed, { borderColor: ink }]}>
        <Text style={[styles.dayNum, styles.dayNumToday, { color: ink }]}>{day.dayOfMonth}</Text>
      </View>
    );
  }
  const upcoming = day.state === 'future' || day.state === 'inactive';
  return (
    <View
      style={[
        styles.dot,
        upcoming ? [styles.dashed, { borderColor: ring, opacity: 0.6 }] : { backgroundColor: fill, borderColor: ring, borderWidth: 2 },
      ]}>
      <Text style={[styles.dayNum, { color: label }]}>{day.dayOfMonth}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, justifyContent: 'space-between' },
  // Drawn above the week card, so anything sliding in never goes behind it.
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 2, elevation: 2 },
  flame: { zIndex: 3, elevation: 3 },
  // The roll fades rather than being clipped.
  numberBox: { height: 80, justifyContent: 'center', marginTop: 6 },
  number: { fontSize: 72, fontWeight: '900', letterSpacing: -2.5, lineHeight: 80, textAlign: 'center' },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.7, lineHeight: 34, marginTop: -10, textAlign: 'center' },
  message: { fontSize: 16, lineHeight: 22, textAlign: 'center', maxWidth: 300 },
  bottom: { gap: 18, zIndex: 1 },
  weekCard: { borderWidth: 2, borderRadius: 22, paddingTop: 14, paddingBottom: 16, paddingHorizontal: 10, gap: 10 },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  weekdayToday: { fontWeight: '900' },
  cell: { flex: 1, alignItems: 'center' },
  dot: { width: DAY, height: DAY, borderRadius: DAY / 2, alignItems: 'center', justifyContent: 'center' },
  dashed: { borderWidth: 2, borderStyle: 'dashed' },
  dayNum: { fontSize: 13, fontWeight: '700' },
  dayNumToday: { fontWeight: '900' },
  actions: { gap: 4 },
  cta: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 17, fontWeight: '800' },
  share: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareText: { fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
