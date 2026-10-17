import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StreakDayTracker } from '@/components/home/StreakDayTracker';
import { StickerFlame } from '@/components/home/StickerFlame';
import { StickerHeart } from '@/components/home/StickerHeart';
import { DashedRing } from '@/components/ui/DashedRing';
import { StreakRestoreBanner } from '@/components/home/StreakRestoreBanner';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, colorWithAlpha, paperEdge, separatorColor } from '@/components/ui/primitives';
import { ringColor } from '@/constants/design-system';
import { useStreak } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { closeStackScreen } from '@/lib/router';
import { emptyStreakStatus, isStreakRestoreAvailable, partnerStreakCount, togetherStreakCount } from '@/lib/streak';
import { STREAK_COLORS, TOGETHER_RING } from '@/lib/streak-colors';
import { isStreakVisuallyAtRisk } from '@/lib/streak-reminder-timing';
import { useAuthStore, useRelationshipStore } from '@/stores';

/** Text and icons on the light chips over the band (same as the profile page). */
const INK = '#1A1A1A';

/** Whether a #rrggbb colour is dark enough to need light status-bar icons. */
function isDarkColor(hex: string) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

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
  // The top band, like the profile page: the theme's hero colour, flat, running up under
  // the status bar with curved bottom corners.
  const band = colors.hero ? colors.hero[0] : colors.gradient[0];
  const ink = colors.onHero ?? colors.onGradient;
  // Follows the band's own text: white text means white icons (Starlight's pink has dark text).
  const bandIsDark = !isDarkColor(ink);
  // While the band is behind the status bar its icons follow the band, then the theme.
  const [bandHeight, setBandHeight] = useState(0);
  const [pastBand, setPastBand] = useState(false);
  useFocusEffect(
    useCallback(() => {
      const light = pastBand ? colors.isDark : bandIsDark;
      setStatusBarStyle(light ? 'light' : 'dark', true);
      return () => setStatusBarStyle(colors.isDark ? 'light' : 'dark', true);
    }, [pastBand, bandIsDark, colors.isDark]),
  );
  // Default: every card is a sticker (ink outline).
  const outline = colors.boldBorder && colors.hero ? { borderWidth: 2, borderColor: colors.border } : null;
  const count = status.current_streak;
  const next = MILESTONES.find((m) => m.days > count) ?? null;
  const best = Math.max(status.longest_streak, count);
  const atRisk = count > 0 && isStreakVisuallyAtRisk(status);
  const dark = colors.isDark;
  const soft = dark ? STREAK_COLORS.activeSoftDark : STREAK_COLORS.activeSoftLight;

  // Each of you keeps your own streak; "together" is the days in a row you both checked in.
  // The lines between you, your partner and together: the theme's text at low strength,
  // which shows on every theme (its border colour vanished on the card's surface).
  const divider = separatorColor(colors);
  const theirCount = partnerStreakCount(status);
  const together = togetherStreakCount(status);
  const togetherBest = Math.max(status.together_longest_streak ?? 0, together);
  const myLine = status.user_active_today
    ? `Checked in today · day ${count} is safe`
    : atRisk
      ? 'Ends tonight · check in to keep it'
      : count > 0
        ? 'Not yet today'
        : 'Check in today to start';
  const theirLine = status.partner_active_today
    ? 'Checked in today'
    : status.partner_at_risk
      ? 'Ends tonight'
      : theirCount > 0
        ? 'Not yet today'
        : 'No streak going';

  const explain = () =>
    Alert.alert(
      'How streaks work',
      'Each of you has your own streak. It grows every day you check in: send a moment, share your mood or answer today’s question. Miss a day and it starts over (with Plus you can restore it within 24 hours).\n\nDays you both check in count towards your together streak.',
    );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        // The band is pinned to the top: no pulling the page down past it.
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = bandHeight > 0 && e.nativeEvent.contentOffset.y > bandHeight - insets.top - 12;
          if (past !== pastBand) setPastBand(past);
        }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}>
        <View
          onLayout={(e) => setBandHeight(e.nativeEvent.layout.height)}
          style={[styles.band, { backgroundColor: band, paddingTop: insets.top + 6 }]}>
          <View style={styles.bandTop}>
            {/* Room for the floating back and ? buttons, which stay put as you scroll. */}
            <View style={styles.bandButtonSpace} />
            <Text style={[styles.bandTitle, { color: ink }]} accessibilityRole="header">
              Streak
            </Text>
            <View style={styles.bandButtonSpace} />
          </View>
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
              ? `You’ve shown up ${count} day${count === 1 ? '' : 's'} in a row.`
              : 'Check in today to start day 1.'}
          </Text>
          {best > 0 ? (
            <View style={[styles.bestPill, { borderColor: ink }]}>
              <Text style={[styles.bestText, { color: ink }]}>Best · {best} days</Text>
            </View>
          ) : null}
        </View>

        {isStreakRestoreAvailable(status) ? <StreakRestoreBanner status={status} /> : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>You two</Text>
          <View style={[styles.card, styles.peopleCard, { backgroundColor: colors.surface }, outline]}>
            {/* You */}
            <View style={styles.personRow}>
              <View style={styles.personLead}>
                <CheckAvatar done={status.user_active_today} name={user?.name} url={user?.avatar_url} ring={colors.surface} size={44} />
              </View>
              <View style={styles.todayText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>You</Text>
                <Text style={[styles.cardSub, { color: atRisk && !status.user_active_today ? STREAK_COLORS.atRisk : colors.textSecondary }]}>
                  {myLine}
                </Text>
              </View>
              <View style={styles.personCount}>
                <Text style={[styles.personNum, { color: colors.text }]}>{count}</Text>
                <View style={[styles.personIcon, count > 0 ? undefined : styles.idleFlame]}>
                  <StickerFlame size={28} />
                </View>
              </View>
            </View>
            {/* Your partner */}
            {partner ? (
              <View style={[styles.personRow, styles.personDivider, { borderTopColor: divider }]}>
                <View style={styles.personLead}>
                  <CheckAvatar done={status.partner_active_today} name={partner.name} url={partner.avatar_url} ring={colors.surface} size={44} />
                </View>
                <View style={styles.todayText}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{partnerName}</Text>
                  <Text
                    style={[
                      styles.cardSub,
                      { color: status.partner_at_risk && !status.partner_active_today ? STREAK_COLORS.atRisk : colors.textSecondary },
                    ]}>
                    {theirLine}
                  </Text>
                </View>
                <View style={styles.personCount}>
                  <Text style={[styles.personNum, { color: colors.text }]}>{theirCount}</Text>
                  <View style={[styles.personIcon, theirCount > 0 ? undefined : styles.idleFlame]}>
                    <StickerFlame size={28} />
                  </View>
                </View>
              </View>
            ) : null}
            {/* Together */}
            {partner ? (
              <View style={[styles.personRow, styles.personDivider, { borderTopColor: divider }]}>
                <View style={styles.personLead}>
                  <View style={[styles.togetherBadge, { borderColor: TOGETHER_RING }]}>
                    <Icon name="people" size={24} color={TOGETHER_RING} />
                  </View>
                </View>
                <View style={styles.todayText}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Together</Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                    {status.both_active_today
                      ? 'You both checked in today'
                      : togetherBest > 0
                        ? `Days in a row you both checked in · best ${togetherBest}`
                        : 'Days in a row you both check in'}
                  </Text>
                </View>
                <View style={styles.personCount}>
                  <Text style={[styles.personNum, { color: colors.text }]}>{together}</Text>
                  {/* Same width as the flames above, so the three numbers line up. */}
                  <View style={[styles.personIcon, together > 0 ? undefined : styles.idleFlame]}>
                    <StickerHeart size={30} />
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {next ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Next milestone</Text>
            <View style={[styles.card, styles.milestoneCard, { backgroundColor: colors.surface }, outline]}>
              <View style={styles.milestoneHead}>
                <View style={[styles.milestoneBadge, styles.stickerLit]}>
                  <StickerFlame size={20} />
                  <Text style={[styles.milestoneBadgeDays, { color: colors.text }]}>{next.days}</Text>
                </View>
                <View style={styles.milestoneText}>
                  <Text style={[styles.milestoneTitle, { color: colors.text }]}>{next.label}</Text>
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
              <View style={[styles.track, { backgroundColor: colors.sticker ? (colors.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(26,26,26,0.10)') : colors.surfaceElevated }, paperEdge(colors, 1.5)]}>
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
          <View style={[styles.card, styles.badges, { backgroundColor: colors.surface }, outline]}>
            {MILESTONES.map((m) => {
              const earned = best >= m.days;
              return (
                <View key={m.days} style={styles.badge}>
                  <View
                    style={[
                      styles.badgeCircle,
                      earned ? styles.stickerLit : { borderColor: 'transparent' },
                    ]}>
                    {earned ? null : <DashedRing size={54} color={ringColor(colors)} />}
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

      {/* Back and help float over the page, always reachable (like an album's). */}
      <View pointerEvents="box-none" style={[styles.floatingChips, { top: insets.top + 6 }]}>
        <BandButton icon="chevronLeft" label="Back" onPress={() => closeStackScreen(router)} />
        <BandButton icon="question" label="How streaks work" onPress={explain} />
      </View>
    </View>
  );
}

/** The round light chips on the band (back, help), like the profile's settings button. */
function BandButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.bandButton,
        { backgroundColor: colorWithAlpha('#FFFFFF', 0.72) },
        pressed && { opacity: 0.8 },
      ]}>
      <Icon name={icon} size={24} color={INK} />
    </Pressable>
  );
}

function CheckAvatar({
  done,
  name,
  url,
  ring,
  size = 32,
}: {
  done: boolean;
  name?: string | null;
  url?: string | null;
  ring: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.checkAvatar, { borderColor: ring }]}>
      <Avatar name={name} imageUrl={url} size={size} />
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
  // "You two": padded inside the card; every row is lead (44) · text · number + icon.
  peopleCard: { paddingHorizontal: 16, paddingVertical: 4 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  personDivider: { borderTopWidth: 1 },
  personLead: { width: 52, alignItems: 'center', justifyContent: 'center' },
  personCount: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  personNum: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8, minWidth: 32, textAlign: 'right' },
  personIcon: { width: 32, alignItems: 'center', justifyContent: 'center' },
  togetherBadge: { width: 48, height: 48, borderRadius: 24, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1 },
  // Lit, like the milestone celebration: yellow with a bold ink outline.
  stickerLit: { backgroundColor: '#FFE7A0', borderColor: '#000000', borderWidth: 2 },
  idleFlame: { opacity: 0.4 },
  // Same rhythm as Home: 24 between sections, 10 between a heading and its card.
  scroll: { paddingHorizontal: 16, gap: 24 },
  // Same band as the profile page: edge to edge, under the status bar, curved at the bottom.
  band: {
    marginHorizontal: -16,
    paddingHorizontal: 20,
    paddingBottom: 26,
    alignItems: 'center',
    gap: 2,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  bandBleed: { position: 'absolute', left: 0, right: 0, top: -600, height: 600 },
  bandTop: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  bandTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.6 },
  bandButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bandButtonSpace: { width: 44, height: 44 },
  floatingChips: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 20,
    elevation: 20,
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
  checkAvatar: { borderWidth: 2, borderRadius: 999 },
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
  todayText: { flex: 1, gap: 2, minWidth: 0 },
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
