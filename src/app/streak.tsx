import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StreakDayTracker } from '@/components/home/StreakDayTracker';
import { StickerFlame } from '@/components/home/StickerFlame';
import { DashedRing } from '@/components/ui/DashedRing';
import { StreakRestoreBanner } from '@/components/home/StreakRestoreBanner';
import { heroGradient } from '@/components/home/WelcomeCard';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useStreak } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { closeStackScreen } from '@/lib/router';
import { emptyStreakStatus, isStreakRestoreAvailable } from '@/lib/streak';
import { STREAK_COLORS } from '@/lib/streak-colors';
import { isStreakVisuallyAtRisk } from '@/lib/streak-reminder-timing';
import { useAuthStore, useRelationshipStore } from '@/stores';

/** Streak milestones shown on the page (days). */
const MILESTONES: { days: number; label: string }[] = [
  { days: 7, label: '1 week' },
  { days: 30, label: '1 month' },
  { days: 50, label: '50 days' },
  { days: 100, label: '100 days' },
  { days: 365, label: '1 year' },
];

/**
 * The full streak view, opened from Home's streak pill: the count, today's
 * check-ins, the next milestone, the Week/Month calendar, milestones earned,
 * and a restore offer when a streak has just ended.
 */
export default function StreakScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const { data: streak } = useStreak();
  const status = useMemo(() => streak ?? emptyStreakStatus(relationship?.id ?? 'pending'), [streak, relationship?.id]);
  const partnerName = getFirstName(partner?.name) ?? 'your partner';
  const ink = colors.onAccent;
  const count = status.current_streak;
  const next = MILESTONES.find((m) => m.days > count) ?? null;
  const best = Math.max(status.longest_streak, count);
  const atRisk = count > 0 && isStreakVisuallyAtRisk(status);
  const dark = colors.isDark;
  const soft = dark ? STREAK_COLORS.activeSoftDark : STREAK_COLORS.activeSoftLight;

  const todayLine =
    status.user_active_today && status.partner_active_today
      ? `You both showed up · day ${count} is safe`
      : status.user_active_today
        ? `You’re in · waiting on ${partnerName}`
        : status.partner_active_today
          ? `${partnerName} is in · your turn`
          : 'Neither of you has shown up yet today';

  const explain = () =>
    Alert.alert(
      'How streaks work',
      'Your streak grows every day you both show up in Moments. Miss a day and it starts over. With Plus, you can restore it within 24 hours.',
    );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Streak"
        onBack={() => closeStackScreen(router)}
        right={<HeaderIconButton icon="question" onPress={explain} accessibilityLabel="How streaks work" />}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}>
        {isStreakRestoreAvailable(status) ? <StreakRestoreBanner status={status} /> : null}

        <LinearGradient colors={heroGradient(colors)} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={styles.hero}>
          {/* <View pointerEvents="none" style={styles.glow} /> */}
          <View style={styles.countRow}>
            {/* The milestone screen's flame character. */}
            <View style={count === 0 ? styles.idleFlame : undefined}>
              <StickerFlame size={64} face animated={count > 0} />
            </View>
            <Text style={[styles.count, { color: ink }]}>{count}</Text>
          </View>
          <Text style={[styles.countUnit, { color: ink }]}>
            {atRisk ? 'day streak · ends tonight' : `day${count === 1 ? '' : 's'} streak`}
          </Text>
          <Text style={[styles.heroSub, { color: ink }]}>
            {count > 0
              ? `You and ${partnerName} have shown up ${count} day${count === 1 ? '' : 's'} in a row.`
              : `Show up together today to start day 1.`}
          </Text>
          {best > 0 ? (
            <View style={[styles.bestPill, { borderColor: ink }]}>
              <Text style={[styles.bestText, { color: ink }]}>Best · {best} days</Text>
            </View>
          ) : null}
        </LinearGradient>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today</Text>
          <View style={[styles.card, styles.todayCard, { backgroundColor: colors.surface }]}>
            <View style={styles.avatars}>
              <CheckAvatar
                done={status.user_active_today}
                name={user?.name}
                url={user?.avatar_url}
                ring={colors.surface}
              />
              <View style={styles.overlap}>
                <CheckAvatar
                  done={status.partner_active_today}
                  name={partner?.name}
                  url={partner?.avatar_url}
                  ring={colors.surface}
                />
              </View>
            </View>
            <View style={styles.todayText}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {status.both_active_today ? 'Today counts' : 'Today'}
              </Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{todayLine}</Text>
            </View>
          </View>
        </View>

        {next ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Next milestone</Text>
            <View style={[styles.card, styles.milestoneCard, { backgroundColor: colors.surface }]}>
              <View style={styles.milestoneHead}>
                <View style={[styles.milestoneBadge, styles.stickerLit]}>
                  <StickerFlame size={20} />
                  <Text style={[styles.milestoneBadgeDays, { color: colors.text }]}>{next.days}</Text>
                </View>
                <View style={styles.milestoneText}>
                  <Text style={[styles.milestoneTitle, { color: colors.text }]}>{next.label} together</Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                    {next.days - count === 1 ? 'Just 1 more day' : `${next.days - count} more days`}
                    {count > 0 ? ' in a row' : ' to get there'}
                  </Text>
                </View>
                <View style={[styles.toGoPill, { backgroundColor: soft }]}>
                  <Text style={[styles.toGo, { color: STREAK_COLORS.active }]}>
                    {Math.round(Math.min(100, (count / next.days) * 100))}%
                  </Text>
                </View>
              </View>
              <View style={[styles.track, { backgroundColor: colors.surfaceElevated }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      backgroundColor: STREAK_COLORS.active,
                      width: `${Math.max(count > 0 ? 4 : 0, Math.min(100, (count / next.days) * 100))}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.spread}>
                <Text style={[styles.trackLabel, { color: colors.textTertiary }]}>Day {count}</Text>
                <Text style={[styles.trackLabel, { color: colors.textTertiary }]}>Day {next.days}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Calendar</Text>
          <StreakDayTracker status={status} joinedAt={relationship?.created_at} calendarOnly />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Milestones</Text>
          <View style={[styles.card, styles.badges, { backgroundColor: colors.surface }]}>
            {MILESTONES.map((m) => {
              const earned = best >= m.days;
              return (
                <View key={m.days} style={styles.badge}>
                  <View
                    style={[
                      styles.badgeCircle,
                      earned ? styles.stickerLit : { borderColor: 'transparent' },
                    ]}>
                    {earned ? null : <DashedRing size={54} color={colors.borderStrong} />}
                    <View style={earned ? undefined : styles.idleFlame}>
                      <StickerFlame size={18} />
                    </View>
                    <Text style={[styles.badgeDays, { color: earned ? colors.text : colors.textTertiary }]}>
                      {m.days}
                    </Text>
                  </View>
                  <Text style={[styles.badgeLabel, { color: earned ? colors.text : colors.textSecondary }]}>
                    {m.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function CheckAvatar({
  done,
  name,
  url,
  ring,
}: {
  done: boolean;
  name?: string | null;
  url?: string | null;
  ring: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.checkAvatar, { borderColor: ring }]}>
      <Avatar name={name} imageUrl={url} size={32} />
      <View
        style={[
          styles.checkBadge,
          { borderColor: ring, backgroundColor: done ? STREAK_COLORS.active : colors.surfaceElevated },
        ]}>
        {done ? <Icon name="check" size={10} color="#fff" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Lit, like the milestone celebration: yellow with a bold ink outline.
  stickerLit: { backgroundColor: '#FFE7A0', borderColor: '#000000', borderWidth: 2 },
  idleFlame: { opacity: 0.4 },
  // Same rhythm as Home: 24 between sections, 10 between a heading and its card.
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 24 },
  hero: {
    borderRadius: 28,
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  // The flame sits above the number, centred.
  countRow: { alignItems: 'center', gap: 2 },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -90,
    top: -120,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  count: { fontSize: 60, fontWeight: '900', letterSpacing: -2, lineHeight: 66 },
  countUnit: { fontSize: 17, fontWeight: '800' },
  heroSub: { fontSize: 14, fontWeight: '600', opacity: 0.85, textAlign: 'center', marginTop: 2 },
  bestPill: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5 },
  bestText: { fontSize: 13, fontWeight: '800' },
  card: { borderRadius: 22 },
  todayCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  avatars: { flexDirection: 'row' },
  overlap: { marginLeft: -10 },
  checkAvatar: { borderWidth: 2, borderRadius: 18 },
  checkBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardSub: { fontSize: 13, fontWeight: '600' },
  milestoneCard: { padding: 16, gap: 12 },
  milestoneHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  milestoneBadge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  milestoneBadgeDays: { fontSize: 11, fontWeight: '900', marginTop: -2 },
  milestoneText: { flex: 1, gap: 2 },
  toGoPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  trackLabel: { fontSize: 12, fontWeight: '700', marginTop: -4 },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  kicker: { fontSize: 13, fontWeight: '800' },
  toGo: { fontSize: 14, fontWeight: '800' },
  milestoneTitle: { fontSize: 17, fontWeight: '800' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  badges: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 8 },
  badge: { flex: 1, alignItems: 'center', gap: 8 },
  badgeCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDays: { fontSize: 13, fontWeight: '900', marginTop: -1 },
  badgeLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
