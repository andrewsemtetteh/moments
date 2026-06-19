import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Card } from '@/components/ui/primitives';
import { StreamingPlatformIcon } from '@/components/watch/StreamingPlatformIcon';
import { WatchScreen } from '@/components/watch/WatchScreen';
import { FREE_WATCH_PARTIES_PER_WEEK } from '@/constants/watch-together';
import {
  useUpcomingSessions,
  useWatchHistory,
  useWatchSessionMutations,
} from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { computeWatchStats, earnedBadges, nextBadge } from '@/lib/watch-gamification';
import { useRelationshipStore } from '@/stores';

type HubView = 'start' | 'watchlist' | 'schedule';

export function WatchHub({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (view: HubView) => void;
}) {
  const { colors } = useTheme();
  const partner = useRelationshipStore((s) => s.partner);
  const partnerName = getFirstName(partner?.name) ?? 'your partner';
  const { isPlus, requirePlus } = usePlusGate();

  const { data: history = [] } = useWatchHistory();
  const { data: upcoming = [] } = useUpcomingSessions();
  const { startScheduled } = useWatchSessionMutations();

  const stats = useMemo(() => computeWatchStats(history), [history]);
  const badges = useMemo(() => earnedBadges(stats), [stats]);
  const upNext = useMemo(() => nextBadge(stats), [stats]);

  const partiesLeft = FREE_WATCH_PARTIES_PER_WEEK - stats.partiesThisWeek;

  const handleStartParty = () => {
    if (!isPlus && stats.partiesThisWeek >= FREE_WATCH_PARTIES_PER_WEEK) {
      requirePlus('Unlimited watch parties');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNavigate('start');
  };

  const handleStartScheduled = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startScheduled.mutate(id, {
      onError: () => Alert.alert('Could not start', 'Please try again.'),
    });
  };

  return (
    <WatchScreen title="Watch Together" onClose={onClose}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <View style={styles.heroGlow} pointerEvents="none" />
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Icon name="film" size={26} color="#fff" filled />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>WATCH TOGETHER</Text>
            <Text style={styles.heroTitle}>Movie night, synced</Text>
            <Text style={styles.heroSub}>
              Pick a service, start together, and react in real time while you watch.
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View
        style={[
          styles.quickPanel,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        ]}>
        <Pressable
          onPress={handleStartParty}
          style={({ pressed }) => [
            styles.primaryAction,
            { backgroundColor: colors.accent, opacity: pressed ? 0.92 : 1 },
          ]}>
          <View style={styles.primaryIcon}>
            <Icon name="play" size={22} color={colors.onAccent} filled />
          </View>
          <View style={styles.primaryCopy}>
            <Text style={[styles.primaryTitle, { color: colors.onAccent }]}>Start watch party</Text>
            <Text style={[styles.primarySub, { color: colors.onAccent }]}>
              Netflix, YouTube, Disney+ and more
            </Text>
          </View>
          <Icon name="chevronRight" size={20} color={colors.onAccent} />
        </Pressable>

        {!isPlus && partiesLeft > 0 && partiesLeft < FREE_WATCH_PARTIES_PER_WEEK && (
          <Text style={[styles.limitHint, { color: colors.textTertiary }]}>
            {partiesLeft} free {partiesLeft === 1 ? 'party' : 'parties'} left this week
          </Text>
        )}

        <View style={styles.secondaryRow}>
          <SecondaryTile
            icon="calendar"
            label="Schedule"
            subtitle="Pick a time"
            onPress={() => onNavigate('schedule')}
            colors={colors}
          />
          <SecondaryTile
            icon="list"
            label="Watchlist"
            subtitle="Plan together"
            onPress={() => onNavigate('watchlist')}
            colors={colors}
          />
        </View>
      </View>

      {(stats.streakWeeks > 0 || stats.watched > 0) && (
        <View style={styles.statRow}>
          <StatTile icon="fire" value={stats.streakWeeks} label="week streak" colors={colors} />
          <StatTile icon="film" value={stats.watched} label="watched" colors={colors} />
          <StatTile icon="star" value={badges.length} label="badges" colors={colors} />
        </View>
      )}

      <View style={styles.howSection}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>HOW IT WORKS</Text>
        <View style={[styles.howCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <HowRow
            icon="film"
            title="Pick a service"
            body="Choose Netflix, YouTube, Disney+, or any platform you both use."
            colors={colors}
            accent
          />
          <View style={[styles.howDivider, { backgroundColor: colors.border }]} />
          <HowRow
            icon="play"
            title="Watch in your app"
            body="Open what you want to watch on your phone. Moments keeps chat, reactions, and nudges in sync."
            colors={colors}
          />
        </View>
      </View>

      {upcoming.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>UPCOMING</Text>
          {upcoming.map((s) => (
            <Card key={s.id} style={styles.rowCard}>
              <StreamingPlatformIcon platformId={s.platform_id ?? 'other'} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {s.title}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {s.scheduled_at ? formatWhen(s.scheduled_at) : 'Scheduled'}
                </Text>
              </View>
              <Pressable
                onPress={() => handleStartScheduled(s.id)}
                style={[styles.startNow, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 }}>Start</Text>
              </Pressable>
            </Card>
          ))}
        </View>
      )}

      {history.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>RECENTLY WATCHED</Text>
          {history.slice(0, 4).map((h) => (
            <Card key={h.id} style={styles.rowCard}>
              <StreamingPlatformIcon platformId={h.platform_id ?? 'other'} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {h.title}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                  {formatDistanceToNow(new Date(h.watched_at), { addSuffix: true })}
                </Text>
              </View>
              {h.rating ? <Stars rating={h.rating} colors={colors} /> : null}
            </Card>
          ))}
        </View>
      )}

      {badges.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ACHIEVEMENTS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {badges.map((b) => (
              <View key={b.id} style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 26 }}>{b.emoji}</Text>
                <Text style={[styles.badgeTitle, { color: colors.text }]}>{b.title}</Text>
              </View>
            ))}
          </ScrollView>
          {upNext && (
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
              Next up: {upNext.emoji} {upNext.title} — {upNext.description}
            </Text>
          )}
        </View>
      )}

      {!partner && (
        <Text style={[styles.partnerHint, { color: colors.textTertiary }]}>
          Link {partnerName} to watch together in sync.
        </Text>
      )}
    </WatchScreen>
  );
}

function SecondaryTile({
  icon,
  label,
  subtitle,
  onPress,
  colors,
}: {
  icon: IconName;
  label: string;
  subtitle: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryTile,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <View style={[styles.secondaryIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon name={icon} size={18} color={colors.accent} filled />
      </View>
      <Text style={[styles.secondaryLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.secondarySub, { color: colors.textSecondary }]}>{subtitle}</Text>
    </Pressable>
  );
}

function HowRow({
  icon,
  title,
  body,
  colors,
  accent,
}: {
  icon: IconName;
  title: string;
  body: string;
  colors: ReturnType<typeof useTheme>['colors'];
  accent?: boolean;
}) {
  return (
    <View style={styles.howRow}>
      <View style={[styles.howIcon, { backgroundColor: accent ? colors.accentSoft : colors.surfaceElevated }]}>
        <Icon name={icon} size={18} color={accent ? colors.accent : colors.textSecondary} filled={accent} />
      </View>
      <View style={styles.howCopy}>
        <Text style={[styles.howTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.howBody, { color: colors.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

function StatTile({
  icon,
  value,
  label,
  colors,
}: {
  icon: IconName;
  value: number;
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name={icon} size={16} color={colors.accent} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function Stars({ rating, colors }: { rating: number; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={13} color={i <= rating ? colors.warning : colors.border} filled={i <= rating} />
      ))}
    </View>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'h:mm a')}`;
  return format(d, 'EEE MMM d, h:mm a');
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 24,
    padding: 20,
    paddingBottom: 28,
    overflow: 'hidden',
    marginBottom: -18,
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.12)',
    top: -60,
    right: -40,
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1, gap: 4 },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 2,
  },
  quickPanel: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
  },
  primaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCopy: { flex: 1, gap: 2 },
  primaryTitle: { fontSize: 16, fontWeight: '800' },
  primarySub: { fontSize: 12, opacity: 0.85, lineHeight: 16 },
  limitHint: { fontSize: 12, textAlign: 'center' },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryTile: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { fontSize: 13, fontWeight: '800' },
  secondarySub: { fontSize: 11, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 10 },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  howSection: { gap: 10 },
  howCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  howIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howCopy: { flex: 1, gap: 2 },
  howTitle: { fontSize: 14, fontWeight: '800' },
  howBody: { fontSize: 13, lineHeight: 18 },
  howDivider: { height: StyleSheet.hairlineWidth },
  section: { gap: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  startNow: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  badge: {
    width: 110,
    alignItems: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeTitle: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  partnerHint: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
