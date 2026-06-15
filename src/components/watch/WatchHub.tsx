import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';
import * as Haptics from 'expo-haptics';
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
  const { isPlus, requirePlus } = usePlusGate();

  const { data: history = [] } = useWatchHistory();
  const { data: upcoming = [] } = useUpcomingSessions();
  const { startScheduled } = useWatchSessionMutations();

  const stats = useMemo(() => computeWatchStats(history), [history]);
  const badges = useMemo(() => earnedBadges(stats), [stats]);
  const upNext = useMemo(() => nextBadge(stats), [stats]);

  const handleStartParty = () => {
    if (!isPlus && stats.partiesThisWeek >= FREE_WATCH_PARTIES_PER_WEEK) {
      requirePlus('Unlimited watch parties');
      return;
    }
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
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🍿</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Your cinema, together</Text>
        <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
          Sync the start, react in real time, and build memories around what you watch.
        </Text>
      </View>

      {/* Streak / stats strip */}
      <View style={styles.statRow}>
        <StatTile icon="fire" value={stats.streakWeeks} label="week streak" colors={colors} />
        <StatTile icon="film" value={stats.watched} label="watched" colors={colors} />
        <StatTile icon="star" value={badges.length} label="badges" colors={colors} />
      </View>

      {/* Primary actions */}
      <View style={styles.actionGrid}>
        <ActionCard
          icon="play"
          title="Start watch party"
          subtitle="Sync & react now"
          highlight
          onPress={handleStartParty}
          colors={colors}
        />
        <ActionCard
          icon="calendar"
          title="Schedule date night"
          subtitle="Pick a time"
          onPress={() => onNavigate('schedule')}
          colors={colors}
        />
        <ActionCard
          icon="list"
          title="Watchlist"
          subtitle="Plan together"
          onPress={() => onNavigate('watchlist')}
          colors={colors}
        />
        <ActionCard
          icon="globe"
          title="Connect services"
          subtitle="Your streaming apps"
          onPress={() => onNavigate('start')}
          colors={colors}
        />
      </View>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>UPCOMING</Text>
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

      {/* Recently watched */}
      {history.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>RECENTLY WATCHED</Text>
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

      {/* Badges */}
      {badges.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACHIEVEMENTS</Text>
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

      {/* Suggested (AI - Plus) */}
      <Card style={styles.suggestCard}>
        <View style={styles.suggestHead}>
          <Icon name="moon" size={18} color={colors.accent} filled />
          <Text style={[styles.rowTitle, { color: colors.text }]}>AI date-night picks</Text>
          {!isPlus && (
            <View style={[styles.plusTag, { backgroundColor: colors.accentSoft }]}>
              <Icon name="lock" size={11} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800' }}>Plus</Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
          {isPlus
            ? 'Personalized recommendations based on what you both love watching.'
            : 'Unlock AI recommendations tuned to your shared taste with Moments Plus.'}
        </Text>
        <Pressable
          onPress={() =>
            isPlus
              ? onNavigate('watchlist')
              : requirePlus('AI date-night recommendations')
          }
          style={[styles.suggestBtn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>
            {isPlus ? 'Add a pick to the watchlist' : 'See Plus'}
          </Text>
        </Pressable>
      </Card>

      {!partner && (
        <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center' }}>
          Link your partner to watch together in sync.
        </Text>
      )}
    </WatchScreen>
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
      <Icon name={icon} size={18} color={colors.accent} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function ActionCard({
  icon,
  title,
  subtitle,
  onPress,
  highlight,
  colors,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  highlight?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        {
          backgroundColor: highlight ? colors.accent : colors.surface,
          borderColor: highlight ? colors.accent : colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <Icon name={icon} size={22} color={highlight ? colors.onAccent : colors.accent} />
      <Text style={[styles.actionTitle, { color: highlight ? colors.onAccent : colors.text }]}>{title}</Text>
      <Text
        style={{
          color: highlight ? colors.onAccent : colors.textSecondary,
          fontSize: 12,
          opacity: highlight ? 0.85 : 1,
        }}>
        {subtitle}
      </Text>
    </Pressable>
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
  hero: { alignItems: 'center', gap: 6 },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  heroSub: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320 },
  statRow: { flexDirection: 'row', gap: 10 },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: '47.8%',
    flexGrow: 1,
    gap: 4,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionTitle: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
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
  suggestCard: { gap: 10 },
  suggestHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  plusTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  suggestBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
