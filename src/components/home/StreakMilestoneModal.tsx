import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MilestoneHeroFlame } from '@/components/home/MilestoneHeroFlame';
import { Icon } from '@/components/ui/Icon';
import { Fonts } from '@/constants/theme';
import { useStreak } from '@/hooks/queries';
import {
    buildMilestoneWeek,
    type StreakDayCell,
} from '@/lib/streak-days';
import { markStreakMilestoneSeen } from '@/lib/streak-milestone-storage';
import { streakMilestoneLabel, streakMilestoneStatusMessage } from '@/lib/streak-milestones';
import { useRelationshipStore, useUIStore } from '@/stores';

const BG_TOP = '#3A1010';
const BG_MID = '#1E0808';
const BG_BOTTOM = '#120404';
const TRACK_RED = '#C62828';
const TEXT_MUTED = 'rgba(255,255,255,0.55)';
const FUTURE_FILL = 'rgba(255,255,255,0.1)';
const FLAME_ORANGE = '#FF8C00';
const DAY_FLAME = 25;

const SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: Fonts.serif,
});

export function StreakMilestoneModal() {
  const count = useUIStore((s) => s.streakMilestoneCount);
  const closeStreakMilestone = useUIStore((s) => s.closeStreakMilestone);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: streak } = useStreak();

  const visible = count != null && count > 0;
  const week = useMemo(
    () =>
      count != null
        ? buildMilestoneWeek(count, relationship?.created_at, streak ?? null)
        : [],
    [count, relationship?.created_at, streak],
  );
  const lineSpan = useMemo(() => milestoneWeekLineSpan(week), [week]);
  const statusMessage = useMemo(
    () => streakMilestoneStatusMessage(partner?.name),
    [partner?.name],
  );
  const brandName = (relationship?.relationship_name ?? 'Moments').toLowerCase();

  useEffect(() => {
    if (!visible || !count || !relationship?.id) return;
    void markStreakMilestoneSeen(relationship.id, count);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [visible, count, relationship?.id]);

  if (!visible || count == null) return null;

  const handleClose = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeStreakMilestone();
  };

  return (
    <Modal
      visible
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
      presentationStyle="fullScreen">
      <LinearGradient
        colors={[BG_TOP, BG_MID, BG_BOTTOM]}
        style={styles.screen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}>
        <SafeAreaView style={styles.content} edges={['top', 'bottom']}>
          <View style={styles.topSection}>
            <Text style={styles.brand}>{brandName}</Text>
          </View>

          <View style={styles.mainSection}>
            <MilestoneHeroFlame />
            <Text style={styles.count}>{count}</Text>
            <Text style={styles.countLabel}>{streakMilestoneLabel(count)}</Text>
          </View>

          <View style={styles.bottomSection}>
            <MilestoneWeekTracker days={week} lineSpan={lineSpan} />

            <Text style={styles.status}>
              <Text style={styles.statusLead}>Milestone reached!</Text>
              {'\n'}
              <Text style={styles.statusSub}>{statusMessage}</Text>
            </Text>

            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
              <Text style={styles.ctaText}>Continue</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

function MilestoneWeekTracker({
  days,
  lineSpan,
}: {
  days: StreakDayCell[];
  lineSpan: { start: number; end: number } | null;
}) {
  return (
    <View style={styles.tracker}>
      <View style={styles.weekdayRow}>
        {days.map((day) => (
          <Text key={`label-${day.date.toISOString()}`} style={styles.weekday}>
            {format(day.date, 'EEE').toUpperCase()}
          </Text>
        ))}
      </View>

      <View style={styles.trackRow}>
        {lineSpan ? (
          <View
            style={[
              styles.trackLine,
              {
                left: `${((lineSpan.start + 0.5) / days.length) * 100}%`,
                width: `${((lineSpan.end - lineSpan.start) / days.length) * 100}%`,
              },
            ]}
          />
        ) : null}
        {days.map((day) => (
          <View key={day.date.toISOString()} style={styles.trackCell}>
            <MilestoneDayDot day={day} />
          </View>
        ))}
      </View>
    </View>
  );
}

function milestoneWeekLineSpan(
  days: StreakDayCell[],
): { start: number; end: number } | null {
  let start = -1;
  let end = -1;
  days.forEach((day, index) => {
    const connected =
      day.state === 'completed' ||
      day.state === 'today-done' ||
      (day.isToday &&
        (day.state === 'today-pending' || day.state === 'today-at-risk'));
    if (connected) {
      if (start < 0) start = index;
      end = index;
    }
  });
  if (start < 0 || end <= start) return null;
  return { start, end };
}

function isMilestoneDayFilled(state: StreakDayCell['state']): boolean {
  return state === 'completed' || state === 'today-done';
}

function MilestoneDayDot({ day }: { day: StreakDayCell }) {
  const filled = isMilestoneDayFilled(day.state);
  const isCurrent =
    day.isToday &&
    !filled &&
    (day.state === 'today-pending' || day.state === 'today-at-risk');
  const isFuture = day.state === 'future' || day.state === 'inactive';

  if (filled) {
    return (
      <View style={[styles.dayCircle, styles.dayCircleActive]}>
        <Icon name="fire" size={DAY_FLAME} color={FLAME_ORANGE} filled />
      </View>
    );
  }

  if (isCurrent) {
    return <View style={[styles.dayCircle, styles.dayCircleCurrent]} />;
  }

  return (
    <View
      style={[
        styles.dayCircle,
        isFuture ? styles.dayCircleFuture : styles.dayCircleMuted,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 44,
    paddingBottom: 44,
    justifyContent: 'space-between',
  },
  topSection: {
    minHeight: 56,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  brand: {
    fontFamily: SERIF,
    fontSize: 28,
    fontWeight: '400',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  mainSection: {
    flexShrink: 0,
    minHeight: 272,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  count: {
    fontFamily: SERIF,
    fontSize: 80,
    fontWeight: '400',
    color: '#FFFFFF',
    letterSpacing: -2,
    lineHeight: 86,
    marginTop: 2,
  },
  countLabel: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  bottomSection: {
    flexShrink: 0,
    minHeight: 248,
    gap: 28,
    justifyContent: 'flex-end',
    paddingTop: 8,
    paddingBottom: 16,
  },
  tracker: {
    gap: 14,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: TEXT_MUTED,
  },
  trackRow: {
    flexDirection: 'row',
    position: 'relative',
    alignItems: 'center',
    minHeight: 50,
  },
  trackLine: {
    position: 'absolute',
    top: 23,
    height: 2,
    backgroundColor: TRACK_RED,
    zIndex: 0,
  },
  trackCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dayCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    borderWidth: 1.5,
    borderColor: TRACK_RED,
    backgroundColor: BG_MID,
  },
  dayCircleCurrent: {
    borderWidth: 1.5,
    borderColor: TRACK_RED,
    backgroundColor: BG_MID,
  },
  dayCircleFuture: {
    borderWidth: 0,
    backgroundColor: FUTURE_FILL,
  },
  dayCircleMuted: {
    borderWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  status: {
    textAlign: 'center',
    lineHeight: 24,
    height: 48,
    paddingHorizontal: 4,
  },
  statusLead: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusSub: {
    fontSize: 15,
    fontWeight: '400',
    color: TEXT_MUTED,
  },
  cta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.92,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.1,
  },
});
