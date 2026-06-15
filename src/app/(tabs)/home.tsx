import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { MoodSnapshot } from '@/components/home/MoodSnapshot';
import { StreakBadge } from '@/components/home/StreakBadge';
import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
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
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { filterMediaMoments, filterMomentsForHome, enrichMomentsWithAuthors, getMomentSenderFirstName } from '@/lib/moment-display';
import { shouldShowEntryPaywall } from '@/lib/paywall-storage';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';

const QUICK_ACTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'bored', label: "We're bored", icon: 'dice' },
  { id: 'moment', label: 'Send moment', icon: 'camera' },
  { id: 'plan', label: 'Plan a date', icon: 'calendar' },
  { id: 'journal', label: 'Journal', icon: 'journal' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const setShowJournal = useUIStore((s) => s.setShowJournal);
  const setShowWrapped = useUIStore((s) => s.setShowWrapped);
  const setShowMoodHistory = useUIStore((s) => s.setShowMoodHistory);
  const openPaywall = useUIStore((s) => s.openPaywall);
  const paywallShownThisSession = useUIStore((s) => s.paywallShownThisSession);
  const markPaywallShownThisSession = useUIStore((s) => s.markPaywallShownThisSession);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyResponse, setDailyResponse] = useState('');

  const { data: moods, refetch: refetchMoods } = useMoods();
  const { data: streak, refetch: refetchStreak } = useStreak();
  const { data: challenge, refetch: refetchChallenge } = useDailyChallenge();
  const { data: events, refetch: refetchEvents } = useCalendarEvents();
  const { data: momentsData, refetch: refetchMoments } = useMoments();
  const updateMood = useUpdateMood();

  useRealtimeSubscription('moments');
  useRealtimeSubscription('mood_logs');

  const { isPlus } = useSubscription();

  useEffect(() => {
    if (isPlus || paywallShownThisSession || !relationship || relationship.status === 'ended') return;

    let cancelled = false;
    void shouldShowEntryPaywall().then((show) => {
      if (cancelled || !show) return;
      markPaywallShownThisSession();
      openPaywall();
    });

    return () => {
      cancelled = true;
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
  const upcomingEvents = events?.slice(0, 3) ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchMoods(), refetchStreak(), refetchChallenge(), refetchEvents(), refetchMoments()]);
    setRefreshing(false);
  }, [refetchMoods, refetchStreak, refetchChallenge, refetchEvents, refetchMoments]);

  const submitDailyResponse = async () => {
    if (!challenge || !relationship || !user || !dailyResponse.trim()) return;
    await api.respondToDailyChallenge(challenge.id, user.id, relationship, dailyResponse.trim());
    setDailyResponse('');
    refetchChallenge();
  };

  const onQuickAction = (id: string) => {
    if (id === 'bored') router.push('/(tabs)/activities');
    else if (id === 'moment') setShowMomentCreator(true);
    else if (id === 'plan') router.push('/(tabs)/calendar');
    else if (id === 'journal') setShowJournal(true);
  };

  const smartSuggestion = getSmartSuggestion(moods ?? {}, upcomingEvents.length);
  const myResponded =
    challenge && user && relationship
      ? (relationship.user_1_id === user.id ? challenge.user_1_response : challenge.user_2_response)
      : null;

  return (
    <ScreenContainer padded={false}>
      <AppHeader />
      <TabScreenScroll
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
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
              <View style={styles.avatarOverlap}>
                <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={38} colorsOverride={['#ffffff', '#ffffff']} />
              </View>
            </View>
            {streak && (
              <View style={styles.heroStreak}>
                <Icon name="fire" size={18} color="#fff" filled strokeWidth={1.6} />
                <Text style={styles.heroStreakText}>{streak.current_streak} days</Text>
              </View>
            )}
          </View>
        </LinearGradient>

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

        <View style={styles.section}>
          <MoodSnapshot
            moods={moods ?? {}}
            onSelectMood={(m) => updateMood.mutate(m)}
            onViewHistory={() => setShowMoodHistory(true)}
          />
        </View>

        {streak && (
          <View style={styles.section}>
            <StreakBadge count={streak.current_streak} longest={streak.longest_streak} />
          </View>
        )}

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

        <View style={styles.section}>
          <SectionTitle>Your recap</SectionTitle>
          <Card onPress={() => setShowWrapped(true)} style={styles.recapCard}>
            <Icon name="star" size={24} color={colors.accent} filled />
            <View style={{ flex: 1 }}>
              <Text style={[styles.recapTitle, { color: colors.text }]}>Wrapped {new Date().getFullYear()}</Text>
              <Text style={[styles.recapSub, { color: colors.textSecondary }]}>
                {isPlus ? 'See your year together' : 'Preview your private recap'}
              </Text>
            </View>
            <Icon name="chevronRight" size={20} color={colors.textSecondary} />
          </Card>
        </View>

        {homePartnerMoments.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>
              Moments from {getMomentSenderFirstName(homePartnerMoments[0], user, partner)}
            </SectionTitle>
            <PartnerMomentHome partnerMoments={homePartnerMoments} />
          </View>
        )}

        {upcomingEvents.length > 0 && (
          <View style={styles.section}>
            <SectionTitle action="Calendar" onAction={() => router.push('/(tabs)/calendar')}>
              Coming Up
            </SectionTitle>
            {upcomingEvents.map((e) => (
              <Card key={e.id} style={styles.eventRow}>
                <View style={[styles.eventDateBox, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.eventDay, { color: colors.accent }]}>{format(new Date(e.date_time), 'd')}</Text>
                  <Text style={[styles.eventMonth, { color: colors.accent }]}>{format(new Date(e.date_time), 'MMM')}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventTitle, { color: colors.text }]}>{e.title}</Text>
                  <Text style={[styles.eventTime, { color: colors.textSecondary }]}>{format(new Date(e.date_time), 'EEEE · h:mm a')}</Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Pressable onPress={() => router.push('/(tabs)/activities')}>
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
): { text: string; icon: IconName } {
  const moodValues = Object.values(moods).map((m) => m.mood);
  if (moodValues.includes('stressed') || moodValues.includes('lonely')) {
    return { text: 'Your partner might love a check-in message today', icon: 'chat' };
  }
  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    return { text: "It's the weekend. Find a date idea together", icon: 'compass' };
  }
  if (eventCount === 0) {
    return { text: 'No plans yet. Schedule something special', icon: 'calendar' };
  }
  return { text: 'Play a quick game together to keep your streak', icon: 'gamepad' };
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
  heroStreakText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  quickItem: { alignItems: 'center', flex: 1, gap: 6 },
  quickIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  quickLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  section: { marginTop: 18 },
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
  recapCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  recapTitle: { fontSize: 16, fontWeight: '800' },
  recapSub: { fontSize: 13, marginTop: 2 },
});
