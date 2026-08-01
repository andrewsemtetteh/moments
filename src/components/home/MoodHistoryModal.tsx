import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoodHistoryOverview } from '@/components/home/MoodHistoryOverview';
import { MoodHistoryTimeline } from '@/components/home/MoodHistoryTimeline';
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

  const isLoading = tab === 'overview' ? overviewLoading : timelineLoading;
  const isError = tab === 'overview' ? overviewError : timelineError;
  const errorMessage = toUserFacingNetworkError(
    tab === 'overview' ? overviewErr : timelineErr,
    'Could not load mood history.',
  ).message;
  const isRefreshing = overviewRefetching || timelineRefetching;

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

  if (!visible) return null;

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
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={10} style={styles.headerSide} accessibilityLabel="Close">
            <Icon name="close" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.title, { color: colors.text }]}>Mood history</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Trends and timeline for you two
            </Text>
          </View>
          <View style={styles.headerSide} />
        </View>

        <View style={[styles.filterRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
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
                  active && { backgroundColor: colors.surface },
                  disabled && styles.filterChipDisabled,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}>
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? colors.text : colors.textSecondary },
                    disabled && { color: colors.textTertiary },
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.segment, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {(['overview', 'timeline'] as const).map((key) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => selectTab(key)}
                style={[styles.segmentItem, active && { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}>
                <Text style={[styles.segmentText, { color: active ? colors.text : colors.textSecondary }]}>
                  {key === 'overview' ? 'Overview' : 'Timeline'}
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

        {isRefreshing && !isLoading ? (
          <View style={[styles.refreshPill, { backgroundColor: colors.surfaceElevated }]}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerSide: { width: 56, paddingTop: 2 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  filterRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
  },
  filterChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  filterChipDisabled: { opacity: 0.45 },
  filterText: { fontSize: 13, fontWeight: '700' },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  segmentText: { fontSize: 14, fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingTop: 2 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  errorBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  refreshPill: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
});
