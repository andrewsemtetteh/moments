import * as Haptics from '@/lib/haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// Gesture-aware ScrollView: scrolls cleanly inside the page's swipe-back gesture.
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoodHistoryOverview } from '@/components/home/MoodHistoryOverview';
import { MoodHistoryTimeline } from '@/components/home/MoodHistoryTimeline';
import { FullScreenPage } from '@/components/layout/FullScreenPage';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { useMoodHistory, useMoodHistoryOverview } from '@/hooks/queries';
import { useEnsurePartner } from '@/hooks/useEnsurePartner';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { buildMoodTimeline, type MoodHistoryFilter } from '@/lib/mood-history';
import { toUserFacingNetworkError } from '@/lib/network-error';
import { AnalyticsEvents, track } from '@/services/analytics';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';

type MoodHistoryTab = 'overview' | 'timeline';

export function MoodHistoryModal() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const visible = useUIStore((s) => s.showMoodHistory);
  const setVisible = useUIStore((s) => s.setShowMoodHistory);
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationship = useRelationshipStore((s) => s.relationship);
  useEnsurePartner();

  const partnerFirstName = getFirstName(partner?.name) ?? 'Partner';
  const filters = useMemo(
    () =>
      [
        { key: 'all' as const, label: 'Both' },
        { key: 'me' as const, label: 'Me' },
        { key: 'partner' as const, label: partnerFirstName },
      ] satisfies { key: MoodHistoryFilter; label: string }[],
    [partnerFirstName],
  );

  const [tab, setTab] = useState<MoodHistoryTab>('overview');
  const [filter, setFilter] = useState<MoodHistoryFilter>('all');
  const trackedOpenRef = useRef(false);

  const {
    data: timelinePages,
    isLoading: timelineLoading,
    isError: timelineError,
    error: timelineErr,
    refetch: refetchTimeline,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching: timelineRefetching,
  } = useMoodHistory(filter);

  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
    error: overviewErr,
    refetch: refetchOverview,
    isRefetching: overviewRefetching,
  } = useMoodHistoryOverview(filter);

  const timelineLogs = useMemo(
    () => timelinePages?.pages.flat() ?? [],
    [timelinePages],
  );

  const timeline = useMemo(
    () => buildMoodTimeline(timelineLogs, user?.id ?? '', partner?.name),
    [timelineLogs, user?.id, partner?.name],
  );

  const isError = tab === 'overview' ? overviewError : timelineError;
  const errorMessage = toUserFacingNetworkError(
    tab === 'overview' ? overviewErr : timelineErr,
    'Could not load mood history.',
  ).message;
  const isRefreshing = overviewRefetching || timelineRefetching;
  // Nothing to show for this tab + filter (also before you're connected).
  const isEmpty =
    tab === 'overview'
      ? !overviewLoading && !overviewError && (!overview || overview.summary.total === 0)
      : !timelineLoading && !timelineError && timeline.length === 0;
  const emptyCopy =
    filter === 'partner'
      ? { title: `${partnerFirstName} hasn’t set a mood yet`, body: 'Their moods will show up here once they do.' }
      : filter === 'me'
        ? { title: 'No moods from you yet', body: 'Tap how you feel on Home and it’ll show up here.' }
        : { title: 'No moods yet', body: 'Tap how you’re feeling on Home. Both of your moods will show up here.' };

  useEffect(() => {
    if (!visible) {
      setTab('overview');
      setFilter('all');
      trackedOpenRef.current = false;
      return;
    }

    if (trackedOpenRef.current || !relationship || !user) return;
    trackedOpenRef.current = true;
    track({
      relationshipId: relationship.id,
      userId: user.id,
      eventType: AnalyticsEvents.MOOD_VIEWED,
      metadata: { source: 'home_mood_snapshot' },
    });
  }, [visible, relationship, user]);

  const close = () => setVisible(false);

  const selectTab = (next: MoodHistoryTab) => {
    Haptics.selectionAsync();
    setTab(next);
  };

  const selectFilter = (next: MoodHistoryFilter) => {
    if (next === 'partner' && !partner) return;
    Haptics.selectionAsync();
    setFilter(next);
  };

  const onRefresh = () => {
    void Promise.all([refetchOverview(), refetchTimeline()]);
  };

  const onRetry = () => {
    void Promise.all([refetchOverview(), refetchTimeline()]);
  };

  return (
    // A page like Settings: slides in, back arrow, swipe right to go back.
    <FullScreenPage visible={visible} title="Mood history" onBack={close}>
      <View style={styles.container}>
        {/* Overview | Timeline — the same tabs as Together's Plan | Memories. */}
        <View style={[styles.segment, { backgroundColor: colors.surface }]}>
          {(['overview', 'timeline'] as const).map((key) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => selectTab(key)}
                style={[styles.segmentItem, active && { backgroundColor: colors.text }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}>
                <Text style={[styles.segmentText, { color: active ? colors.background : colors.textSecondary }]}>
                  {key === 'overview' ? 'Overview' : 'Timeline'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Whose moods — pills like Together's filter. */}
        <View style={styles.filterRow}>
          {filters.map((item) => {
            const disabled = item.key === 'partner' && !partner;
            const active = filter === item.key;
            return (
              <Pressable
                key={item.key}
                disabled={disabled}
                onPress={() => selectFilter(item.key)}
                style={[
                  styles.filterChip,
                  { backgroundColor: active ? colors.text : colors.surface },
                  disabled && styles.filterChipDisabled,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}>
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? colors.background : colors.text },
                    disabled && { color: colors.textTertiary },
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {((tab === 'overview' && overviewLoading && !overview) ||
          (tab === 'timeline' && timelineLoading && timelineLogs.length === 0)) &&
        !isError ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : isEmpty ? (
          // Same empty state as the other pages: tinted icon, title, one line.
          <View style={[styles.empty, { paddingBottom: insets.bottom + 60 }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon name="happy" size={30} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{emptyCopy.title}</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{emptyCopy.body}</Text>
          </View>
        ) : isError && ((tab === 'overview' && overviewError) || (tab === 'timeline' && timelineError)) ? (
          <View style={styles.errorWrap}>
            <Text style={[styles.errorTitle, { color: colors.text }]}>Couldn&apos;t load mood history</Text>
            <Text style={[styles.errorBody, { color: colors.textSecondary }]}>{errorMessage}</Text>
            <PrimaryButton label="Try again" onPress={onRetry} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                tintColor={colors.accent}
                colors={[colors.accent]}
                onRefresh={onRefresh}
              />
            }>
            {tab === 'overview' && overview ? (
              <MoodHistoryOverview
                colors={colors}
                dailyActivity={overview.daily}
                moodCounts={overview.counts}
                partnerWeekly={overview.partnerWeekly}
                showPartnerComparison={filter === 'all' && !!partner}
                partnerName={partner?.name}
                total={overview.summary.total}
                topMood={overview.summary.topMood}
                topMoodCount={overview.summary.topMoodCount}
              />
            ) : null}

            {tab === 'timeline' ? (
              <MoodHistoryTimeline
                colors={colors}
                sections={timeline}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={() => void fetchNextPage()}
              />
            ) : null}
          </ScrollView>
        )}
      </View>
    </FullScreenPage>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segment: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, padding: 4, borderRadius: 999 },
  segmentItem: { flex: 1, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 15, fontWeight: '800' },
  filterRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center' },
  filterChipDisabled: { opacity: 0.45 },
  filterText: { fontSize: 14, fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  errorBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
