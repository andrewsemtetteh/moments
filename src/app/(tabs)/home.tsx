import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ContinueChatCard } from '@/components/home/ContinueChatCard';
import {
  InviteCard,
  NextUpCard,
  NoMomentCard,
  OnThisDayCard,
  useOnThisDay,
} from '@/components/home/HomeCards';
import { MoodSnapshot } from '@/components/home/MoodSnapshot';
import { StreakRestoreBanner } from '@/components/home/StreakRestoreBanner';
import { TodaysPromptCard } from '@/components/home/TodaysPromptCard';
import { WelcomeCard } from '@/components/home/WelcomeCard';
import { PlayPulseCard } from '@/components/games/PlayPulse';
import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { TabSwipe } from '@/components/layout/TabSwipe';
import { PartnerMomentHome } from '@/components/moments/PartnerMomentHome';
import { Spacing } from '@/constants/design-system';
import {
  useDailyChallenge,
  useMemoryEntries,
  useMoments,
  useMoods,
  useRealtimeSubscription,
  useStreak,
  useUpcomingCalendarEvents,
  useUpdateMood,
} from '@/hooks/queries';
import { useOpenPartnerProfile } from '@/hooks/useOpenPartnerProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { isHiddenFrom } from '@/lib/plan-day';
import { enrichMomentsWithAuthors, filterMediaMoments, filterMomentsForHome } from '@/lib/moment-display';
import { shouldShowEntryPaywall } from '@/lib/paywall-storage';
import { openActivities, openCalendar } from '@/lib/router';
import { emptyStreakStatus, isStreakRestoreAvailable } from '@/lib/streak';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Moment } from '@/types/database';

const HOME_REFRESH_TIMEOUT_MS = 8_000;

/**
 * Home, top to bottom:
 *   welcome card (greeting · space name · both of you · streak + this week)
 *   → your partner's latest moment (or a nudge / the invite)
 *   → Today: how you're feeling · today's question · next plan · unread chat
 *   → a memory from this day in an earlier year · Play
 */
export default function HomeScreen() {
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const setShowMoodHistory = useUIStore((s) => s.setShowMoodHistory);
  const openPaywall = useUIStore((s) => s.openPaywall);
  const openPartnerProfile = useOpenPartnerProfile();
  const paywallShownThisSession = useUIStore((s) => s.paywallShownThisSession);
  const markPaywallShownThisSession = useUIStore((s) => s.markPaywallShownThisSession);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const refreshInFlightRef = useRef(false);

  const { data: moods } = useMoods();
  const { data: streak } = useStreak();
  const { data: challenge } = useDailyChallenge();
  const { data: upcoming = [] } = useUpcomingCalendarEvents();
  const { data: memories = [] } = useMemoryEntries();
  const { data: momentsData } = useMoments();
  const updateMood = useUpdateMood();

  useRealtimeSubscription('moments');
  useRealtimeSubscription('mood_logs');
  useRealtimeSubscription('daily_challenges');
  useRealtimeSubscription('messages');

  const { isPlus } = useSubscription();

  useEffect(() => {
    if (isPlus || paywallShownThisSession || !relationship || relationship.status === 'ended') return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void shouldShowEntryPaywall().then((show) => {
        if (cancelled || !show) return;
        markPaywallShownThisSession();
        openPaywall();
      });
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isPlus, paywallShownThisSession, relationship, markPaywallShownThisSession, openPaywall]);

  const homePartnerMoments = useMemo(() => {
    const enriched = enrichMomentsWithAuthors(
      filterMediaMoments(momentsData?.pages[0] ?? []),
      user,
      partner,
    );
    const partnerOnly = enriched.filter((m) =>
      partner?.id ? m.user_id === partner.id : m.user_id !== user?.id,
    );
    return filterMomentsForHome(partnerOnly);
  }, [momentsData, partner, user]);

  const momentsById = useMemo(
    () => new Map(filterMediaMoments(momentsData?.pages.flat() ?? []).map((m) => [m.id, m])),
    [momentsData],
  );

  const relationshipId = relationship?.id;
  const streakStatus = useMemo(
    () => streak ?? emptyStreakStatus(relationshipId ?? 'pending'),
    [streak, relationshipId],
  );
  const restoreStatus = streak && isStreakRestoreAvailable(streak) ? streak : null;

  // "Next up" is re-checked whenever Home comes back into view (and on pull
  // to refresh), so a plan that's already started drops off. Partner's
  // private plans are skipped — "Busy" isn't worth a card here.
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );
  const nextUp = useMemo(
    () =>
      upcoming.find(
        (e) => new Date(e.date_time).getTime() >= now && !isHiddenFrom(e, user?.id),
      ) ?? null,
    [upcoming, now, user?.id],
  );
  const onThisDay = useOnThisDay(memories);

  const onRefresh = useCallback(() => {
    if (!relationshipId || refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    setRefreshing(true);
    setNow(Date.now());

    let finished = false;
    const finishRefresh = () => {
      if (finished) return;
      finished = true;
      setRefreshing(false);
      refreshInFlightRef.current = false;
    };

    const timeoutId = setTimeout(finishRefresh, HOME_REFRESH_TIMEOUT_MS);

    void (async () => {
      try {
        queryClient.setQueryData<InfiniteData<Moment[]>>(
          ['moments', relationshipId],
          (current) => {
            if (!current?.pages.length) return current;
            return {
              pages: current.pages.slice(0, 1),
              pageParams: current.pageParams.slice(0, 1),
            };
          },
        );

        await Promise.allSettled([
          queryClient.refetchQueries({ queryKey: ['moods', relationshipId], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['streak', relationshipId], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['daily-challenge', relationshipId], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['calendar', relationshipId], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['calendarUpcoming', relationshipId], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['moments', relationshipId], type: 'active' }),
          queryClient.refetchQueries({
            queryKey: ['moodFrequency', relationshipId, user?.id],
            type: 'active',
          }),
          queryClient.refetchQueries({
            queryKey: ['latestMessage', relationshipId, user?.id],
            type: 'active',
          }),
          queryClient.refetchQueries({
            queryKey: ['unreadMessages', relationshipId, user?.id],
            type: 'active',
          }),
        ]);
      } finally {
        clearTimeout(timeoutId);
        finishRefresh();
      }
    })();
  }, [queryClient, relationshipId, user?.id]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={colors.accent}
        colors={[colors.accent]}
        progressViewOffset={Platform.OS === 'android' ? 0 : undefined}
      />
    ),
    [colors.accent, onRefresh, refreshing],
  );

  return (
    // Together ← Home → Play (see TabSwipe).
    <TabSwipe onSwipeRight={() => openCalendar()} onSwipeLeft={() => openActivities()}>
      <ScreenContainer padded={false}>
        <AppHeader />
        <TabScreenScroll
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          contentContainerStyle={styles.scroll}>
          <WelcomeCard
            user={user ?? null}
            partner={partner}
            spaceName={relationship?.relationship_name}
            status={session ? streakStatus : null}
            joinedAt={relationship?.created_at}
            onPressPartner={() => openPartnerProfile()}
          />

          {restoreStatus ? <StreakRestoreBanner status={restoreStatus} /> : null}

          {!partner ? (
            relationship ? <InviteCard /> : null
          ) : homePartnerMoments.length > 0 ? (
            <PartnerMomentHome partnerMoments={homePartnerMoments} />
          ) : (
            <NoMomentCard partnerName={partner.name} />
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Today</Text>

            <MoodSnapshot
              moods={moods ?? {}}
              onSelectMood={(m) => updateMood.mutate(m)}
              onViewHistory={() => setShowMoodHistory(true)}
            />

            {challenge ? (
              <TodaysPromptCard challenge={challenge} onOpenHistory={() => router.push('/question-history')} />
            ) : null}

            {nextUp ? <NextUpCard event={nextUp} viewerId={user?.id} /> : null}

            {/* Shows itself only when there's something to continue. */}
            {session && partner ? <ContinueChatCard /> : null}
          </View>

          {onThisDay ? <OnThisDayCard entry={onThisDay} momentsById={momentsById} /> : null}

          {session && partner ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Play</Text>
              <PlayPulseCard />
            </View>
          ) : null}

        </TabScreenScroll>
      </ScreenContainer>
    </TabSwipe>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  section: { gap: Spacing.md },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
});
