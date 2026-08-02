import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AnimatedStreakFire } from '@/components/home/AnimatedStreakFire';
import { ContinueChatCard } from '@/components/home/ContinueChatCard';
import { MoodSnapshot } from '@/components/home/MoodSnapshot';
import { PromptHistoryModal } from '@/components/home/PromptHistoryModal';
import { StreakDayTracker } from '@/components/home/StreakDayTracker';
import { StreakEndCard } from '@/components/home/StreakEndCard';
import { StreakRestoreBanner } from '@/components/home/StreakRestoreBanner';
import { TodaysPromptCard } from '@/components/home/TodaysPromptCard';
import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { MomentsStrip } from '@/components/moments/MomentsStrip';
import { PartnerMomentHome } from '@/components/moments/PartnerMomentHome';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, Card, SectionTitle } from '@/components/ui/primitives';
import {
    useCalendarEvents,
    useDailyChallenge,
    useMoments,
    useMoods,
    useRealtimeSubscription,
    useStreak,
    useUpdateMood,
} from '@/hooks/queries';
import { useOpenPartnerProfile } from '@/hooks/useOpenPartnerProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { enrichMomentsWithAuthors, filterMediaMoments, filterMomentsForHome } from '@/lib/moment-display';
import { shouldShowEntryPaywall } from '@/lib/paywall-storage';
import { openActivities, openCalendar, openChat } from '@/lib/router';
import {
    emptyStreakStatus,
    getStreakEndVariant,
    isStreakRestoreAvailable,
} from '@/lib/streak';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Moment } from '@/types/database';

const HOME_REFRESH_TIMEOUT_MS = 8_000;

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
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const queryClient = useQueryClient();
  const refreshInFlightRef = useRef(false);

  const { data: moods } = useMoods();
  const { data: streak } = useStreak();
  const { data: challenge } = useDailyChallenge();
  const { data: events } = useCalendarEvents();
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

  const stripMoments = useMemo(() => {
    const enriched = enrichMomentsWithAuthors(
      filterMediaMoments(momentsData?.pages.flat() ?? []),
      user,
      partner,
    );
    return filterMomentsForHome(enriched);
  }, [momentsData, user, partner]);
  const upcomingEvents = events?.slice(0, 3) ?? [];

  const relationshipId = relationship?.id;

  const streakStatus = useMemo(
    () => streak ?? emptyStreakStatus(relationshipId ?? 'pending'),
    [streak, relationshipId],
  );

  const restoreStatus = useMemo(() => {
    if (streak && isStreakRestoreAvailable(streak)) return streak;
    return null;
  }, [streak]);

  const endCardStatus = useMemo(() => {
    if (!streak) return null;
    // Restore uses the dedicated banner; EndCard covers at-risk / ended.
    if (getStreakEndVariant(streak) === 'restore') return null;
    return streak;
  }, [streak]);

  const onRefresh = useCallback(() => {
    if (!relationshipId || refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    setRefreshing(true);

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

  const smartSuggestion = getSmartSuggestion(moods ?? {}, upcomingEvents.length, partner?.name);

  return (
    <ScreenContainer padded={false} tabSwipe>
      <AppHeader />
      <TabScreenScroll
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <Text style={styles.greeting}>{greeting(user?.name)}</Text>
          <Text style={styles.heroName}>{relationship?.relationship_name ?? 'Moments'}</Text>
          <View style={styles.heroFooter}>
            <View style={styles.avatars}>
              <Avatar name={user?.name} imageUrl={user?.avatar_url} size={38} colorsOverride={['#ffffff', '#ffffff']} />
              <Pressable
                style={styles.avatarOverlap}
                onPress={() => openPartnerProfile()}
                disabled={!partner}
                accessibilityRole="button"
                accessibilityLabel={partner ? `View ${partner.name ?? 'partner'} profile` : 'Partner profile'}>
                <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={38} colorsOverride={['#ffffff', '#ffffff']} />
              </Pressable>
            </View>
            {session ? (
              <View
                style={[
                  styles.heroStreak,
                  streakStatus.at_risk && styles.heroStreakAtRisk,
                ]}>
                <AnimatedStreakFire
                  color="#fff"
                  size={18}
                  animate={false}
                />
                <Text style={styles.heroStreakText}>
                  {streakStatus.current_streak > 0
                    ? `${streakStatus.current_streak} day${streakStatus.current_streak === 1 ? '' : 's'}`
                    : 'Start streak'}
                </Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        {session ? (
          <View style={styles.streakTracker}>
            <StreakDayTracker status={streakStatus} joinedAt={relationship?.created_at} />
            {restoreStatus ? <StreakRestoreBanner status={restoreStatus} /> : null}
            {endCardStatus ? <StreakEndCard status={endCardStatus} /> : null}
          </View>
        ) : null}

        {homePartnerMoments.length > 0 && (
          <View>
            <SectionTitle>Moments</SectionTitle>
            <MomentsStrip moments={stripMoments} partnerOnly />
            <View style={styles.partnerMomentBlock}>
              <PartnerMomentHome partnerMoments={homePartnerMoments} />
            </View>
          </View>
        )}

        <View>
          <MoodSnapshot
            moods={moods ?? {}}
            onSelectMood={(m) => updateMood.mutate(m)}
            onViewHistory={() => setShowMoodHistory(true)}
          />
        </View>

        {challenge && (
          <TodaysPromptCard
            challenge={challenge}
            onOpenHistory={() => setShowPromptHistory(true)}
          />
        )}

        {session && partner ? <ContinueChatCard /> : null}

        {upcomingEvents.length > 0 && (
          <View>
            <SectionTitle action="Calendar" onAction={() => openCalendar()}>
              Coming Up
            </SectionTitle>
            {upcomingEvents.map((e) => (
              <Pressable key={e.id} onPress={() => openCalendar({ dateISO: e.date_time })}>
                <Card style={styles.eventRow}>
                  <View style={[styles.eventDateBox, { backgroundColor: colors.accentSoft }]}>
                    <Text style={[styles.eventDay, { color: colors.accent }]}>{format(new Date(e.date_time), 'd')}</Text>
                    <Text style={[styles.eventMonth, { color: colors.accent }]}>{format(new Date(e.date_time), 'MMM')}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventTitle, { color: colors.text }]}>{e.title}</Text>
                    <Text style={[styles.eventTime, { color: colors.textSecondary }]}>{format(new Date(e.date_time), 'EEEE · h:mm a')}</Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        <View>
          <Pressable onPress={smartSuggestion.onPress}>
            <LinearGradient
              colors={[colors.accentSoft, colors.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.suggestion, { borderColor: colors.border }]}>
              <View style={styles.suggestionIcon}>
                <Icon name={smartSuggestion.icon} size={22} color={colors.accent} />
              </View>
              <Text style={[styles.suggestionText, { color: colors.text }]}>{smartSuggestion.text}</Text>
              <View style={styles.suggestionIcon}>
                <Icon name="chevronRight" size={20} color={colors.textSecondary} />
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      </TabScreenScroll>
      <PromptHistoryModal visible={showPromptHistory} onClose={() => setShowPromptHistory(false)} />
    </ScreenContainer>
  );
}

function greeting(name?: string | null) {
  const h = new Date().getHours();
  const firstName = getFirstName(name);
  const salutation = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return firstName ? `${salutation}, ${firstName}` : salutation;
}

function getSmartSuggestion(
  moods: Record<string, { mood: string }>,
  eventCount: number,
  partnerName?: string | null,
): { text: string; icon: IconName; onPress: () => void } {
  const partnerFirst = getFirstName(partnerName) ?? 'your partner';
  const moodValues = Object.values(moods).map((m) => m.mood);

  if (moodValues.includes('stressed') || moodValues.includes('lonely')) {
    return {
      text: `${partnerFirst} might love a check-in message today`,
      icon: 'messages',
      onPress: () => openChat('Hey, thinking of you 💛'),
    };
  }

  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    return {
      text: `It's the weekend. Pick a bucket list idea with ${partnerFirst}`,
      icon: 'list',
      onPress: () => openActivities('bucket'),
    };
  }

  if (eventCount === 0) {
    return {
      text: 'No plans yet. Schedule something special',
      icon: 'calendar',
      onPress: () => openCalendar({ create: true }),
    };
  }

  return {
    text: 'Play a quick game together to keep your streak',
    icon: 'gamepad',
    onPress: () => openActivities('games'),
  };
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 18 },
  hero: { borderRadius: 24, padding: 20 },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  heroName: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarOverlap: { marginLeft: -14 },
  heroStreak: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  heroStreakAtRisk: { backgroundColor: 'rgba(224,65,79,0.55)' },
  heroStreakText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  streakTracker: { gap: 18 },
  partnerMomentBlock: { marginTop: 14 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  eventDateBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eventDay: { fontSize: 18, fontWeight: '800', lineHeight: 20 },
  eventMonth: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  eventTitle: { fontSize: 15, fontWeight: '700' },
  eventTime: { fontSize: 13, marginTop: 2 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  suggestionIcon: {
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  suggestionText: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '600' },
});
