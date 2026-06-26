import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { AnimatedStreakFire } from '@/components/home/AnimatedStreakFire';
import { MoodSnapshot } from '@/components/home/MoodSnapshot';
import { StreakDayTracker } from '@/components/home/StreakDayTracker';
import { StreakEndCard } from '@/components/home/StreakEndCard';
import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { MomentsStrip } from '@/components/moments/MomentsStrip';
import { PartnerMomentHome } from '@/components/moments/PartnerMomentHome';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, Card, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
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
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Moment } from '@/types/database';

const HOME_REFRESH_TIMEOUT_MS = 8_000;

const QUICK_ACTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'bored', label: "We're bored", icon: 'dice' },
  { id: 'moment', label: 'Send moment', icon: 'camera' },
  { id: 'plan', label: 'Make plans', icon: 'calendar' },
  { id: 'journal', label: 'Journal', icon: 'journal' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const setShowMoodHistory = useUIStore((s) => s.setShowMoodHistory);
  const openPaywall = useUIStore((s) => s.openPaywall);
  const openPartnerProfile = useOpenPartnerProfile();
  const paywallShownThisSession = useUIStore((s) => s.paywallShownThisSession);
  const markPaywallShownThisSession = useUIStore((s) => s.markPaywallShownThisSession);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyResponse, setDailyResponse] = useState('');
  const queryClient = useQueryClient();
  const refreshInFlightRef = useRef(false);

  const { data: moods } = useMoods();
  const { data: streak, refetch: refetchStreak } = useStreak();
  const { data: challenge, refetch: refetchChallenge } = useDailyChallenge();
  const { data: events } = useCalendarEvents();
  const { data: momentsData } = useMoments();
  const updateMood = useUpdateMood();

  useRealtimeSubscription('moments');
  useRealtimeSubscription('mood_logs');

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

  const submitDailyResponse = async () => {
    if (!challenge || !relationship || !user || !dailyResponse.trim()) return;
    await api.respondToDailyChallenge(challenge.id, user.id, relationship, dailyResponse.trim());
    setDailyResponse('');
    await Promise.all([refetchChallenge(), refetchStreak()]);
  };

  const onQuickAction = (id: string) => {
    if (id === 'bored') openActivities('games');
    else if (id === 'moment') setShowMomentCreator(true);
    else if (id === 'plan') openCalendar({ create: true });
    else if (id === 'journal') router.push('/journal');
  };

  const smartSuggestion = getSmartSuggestion(moods ?? {}, upcomingEvents.length, partner?.name);
  const myResponded =
    challenge && user && relationship
      ? (relationship.user_1_id === user.id ? challenge.user_1_response : challenge.user_2_response)
      : null;

  return (
    <ScreenContainer padded={false}>
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
            {streak && (
              <View
                style={[
                  styles.heroStreak,
                  streak.at_risk && styles.heroStreakAtRisk,
                ]}>
                <AnimatedStreakFire
                  color="#fff"
                  size={18}
                  animate={streak.current_streak > 0 || streak.at_risk}
                  pulse={streak.at_risk}
                  periodic={streak.at_risk ? 3_500 : 5_500}
                />
                <Text style={styles.heroStreakText}>
                  {streak.current_streak > 0
                    ? `${streak.current_streak} day${streak.current_streak === 1 ? '' : 's'}`
                    : 'Start streak'}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {streak && (
          <View style={styles.streakTracker}>
            <StreakDayTracker status={streak} joinedAt={relationship?.created_at} />
            <StreakEndCard status={streak} />
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((a) => (
            <Pressable key={a.id} onPress={() => onQuickAction(a.id)} style={styles.quickItem}>
              <View style={[styles.quickIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name={a.icon} size={22} color={colors.accent} />
              </View>
              <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {homePartnerMoments.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>Moments</SectionTitle>
            <MomentsStrip moments={stripMoments} partnerOnly />
            <View style={styles.partnerMomentBlock}>
              <PartnerMomentHome partnerMoments={homePartnerMoments} />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <MoodSnapshot
            moods={moods ?? {}}
            onSelectMood={(m) => updateMood.mutate(m)}
            onViewHistory={() => setShowMoodHistory(true)}
          />
        </View>

        {challenge && (
          <View style={styles.section}>
            <SectionTitle>Daily Question</SectionTitle>
            <Card>
              <Text style={[styles.prompt, { color: colors.text }]}>{challenge.prompt}</Text>
              {myResponded ? (
                <View style={[styles.answered, { borderColor: colors.border }]}>
                  <Icon name="check" size={16} color={colors.success} />
                  <Text style={{ color: colors.textSecondary, flex: 1 }}>You answered: {myResponded}</Text>
                </View>
              ) : (
                <>
                  <TextInput
                    style={[styles.responseInput, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                    placeholder="Share your answer..."
                    placeholderTextColor={colors.textTertiary}
                    value={dailyResponse}
                    onChangeText={setDailyResponse}
                    multiline
                  />
                  <PrimaryButton label="Share Response" onPress={submitDailyResponse} disabled={!dailyResponse.trim()} />
                </>
              )}
            </Card>
          </View>
        )}

        {upcomingEvents.length > 0 && (
          <View style={styles.section}>
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

        <View style={styles.section}>
          <Pressable onPress={smartSuggestion.onPress}>
            <LinearGradient
              colors={[colors.accentSoft, colors.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.suggestion, { borderColor: colors.border }]}>
              <Icon name={smartSuggestion.icon} size={22} color={colors.accent} />
              <Text style={[styles.suggestionText, { color: colors.text }]}>{smartSuggestion.text}</Text>
              <Icon name="chevronRight" size={20} color={colors.textSecondary} />
            </LinearGradient>
          </Pressable>
        </View>
      </TabScreenScroll>
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
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  hero: { borderRadius: 24, padding: 20, marginBottom: 18 },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  heroName: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarOverlap: { marginLeft: -14 },
  heroStreak: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  heroStreakAtRisk: { backgroundColor: 'rgba(255,180,80,0.35)' },
  heroStreakText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  streakTracker: { marginBottom: 18, gap: 10 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  quickItem: { alignItems: 'center', flex: 1, gap: 6 },
  quickIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  quickLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  section: { marginTop: 18 },
  partnerMomentBlock: { marginTop: 14 },
  prompt: { fontSize: 18, lineHeight: 26, marginBottom: 14, fontWeight: '600' },
  responseInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 64, fontSize: 15, marginBottom: 12, textAlignVertical: 'top' },
  answered: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  eventDateBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eventDay: { fontSize: 18, fontWeight: '800', lineHeight: 20 },
  eventMonth: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  eventTitle: { fontSize: 15, fontWeight: '700' },
  eventTime: { fontSize: 13, marginTop: 2 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  suggestionText: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '600' },
});
