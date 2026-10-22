import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Platform, RefreshControl, StyleSheet, Text, View } from "react-native";

import { ContinueChatCard } from "@/components/home/ContinueChatCard";
import {
  InviteCard,
  NextUpCard,
  OnThisDayCard,
  useOnThisDay, PartnerBirthdayCard, MyBirthdayCard } from "@/components/home/HomeCards";
import { MoodSnapshot } from "@/components/home/MoodSnapshot";
import { StreakAtRiskBanner } from "@/components/home/StreakAtRiskBanner";
import { StreakRestoreBanner } from "@/components/home/StreakRestoreBanner";
import { ActivitiesIntroSection } from "@/components/activities/ActivitiesIntroSection";
import { introBand, WelcomeCard } from "@/components/home/WelcomeCard";
import { PlayPulseCard } from "@/components/games/PlayPulse";
import { AppHeader } from "@/components/layout/AppHeader";
import { ScreenContainer } from "@/components/layout/ScreenContainer";
import { TabScreenScroll } from "@/components/layout/TabScreenScroll";
import { TabSwipe } from "@/components/layout/TabSwipe";
import { PartnerMomentHome } from "@/components/moments/PartnerMomentHome";
import { Spacing } from "@/constants/design-system";
import {
  useDailyChallenge,
  useMemoryEntries,
  useMoments,
  useMoods,
  useRealtimeSubscription,
  useStreak,
  useUpcomingCalendarEvents,
  useUpdateMood,
} from "@/hooks/queries";
import { useOpenPartnerProfile } from "@/hooks/useOpenPartnerProfile";
// import { useSubscription } from '@/hooks/useSubscription';
import { useStatusBarStyle } from "@/hooks/useLightStatusBar";
import { useTheme } from "@/hooks/useTheme";
import { isHiddenFrom } from "@/lib/plan-day";
import {
  enrichMomentsWithAuthors,
  filterMediaMoments,
  filterMomentsForHome,
} from "@/lib/moment-display";
// import { shouldShowEntryPaywall } from '@/lib/paywall-storage';
import { openActivities, openCalendar } from "@/lib/router";
import { emptyStreakStatus, isStreakRestoreAvailable } from "@/lib/streak";
import { useAuthStore, useRelationshipStore, useUIStore } from "@/stores";
import type { Moment } from "@/types/database";
import { TourTarget } from "@/components/layout/TourTarget";

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
  // const openPaywall = useUIStore((s) => s.openPaywall);
  const openPartnerProfile = useOpenPartnerProfile();
  // const paywallShownThisSession = useUIStore((s) => s.paywallShownThisSession);
  // const markPaywallShownThisSession = useUIStore((s) => s.markPaywallShownThisSession);
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

  useRealtimeSubscription("moments");
  useRealtimeSubscription("mood_logs");
  useRealtimeSubscription("daily_challenges");
  useRealtimeSubscription("messages");

  // The weekly Home reminder now lives in PaywallMoments (with the partner joined,
  // milestone and win back moments); free limits open the paywall through requirePlus.
  // const { isPlus } = useSubscription();

  // useEffect(() => {
  //   if (isPlus || paywallShownThisSession || !relationship || relationship.status === 'ended') return;

  //   let cancelled = false;
  //   const timer = setTimeout(() => {
  //     void shouldShowEntryPaywall().then((show) => {
  //       if (cancelled || !show) return;
  //       markPaywallShownThisSession();
  //       openPaywall();
  //     });
  //   }, 800);

  //   return () => {
  //     cancelled = true;
  //     clearTimeout(timer);
  //   };
  // }, [isPlus, paywallShownThisSession, relationship, markPaywallShownThisSession, openPaywall]);

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
    () =>
      new Map(
        filterMediaMoments(momentsData?.pages.flat() ?? []).map((m) => [
          m.id,
          m,
        ]),
      ),
    [momentsData],
  );

  const relationshipId = relationship?.id;
  const streakStatus = useMemo(
    () => streak ?? emptyStreakStatus(relationshipId ?? "pending"),
    [streak, relationshipId],
  );
  const restoreStatus =
    streak && isStreakRestoreAvailable(streak) ? streak : null;

  // "Next up" is re-checked whenever Home comes back into view (and on pull
  // to refresh), so a plan that's already started drops off. Partner's
  // private plans are skipped — "Busy" isn't worth a card here.
  // The header and intro card are one band in the theme's hero colour; the status bar
  // icons follow it while Home is in view, then go back to the theme's.
  // Once the card has scrolled up under the header, the header goes back to the theme's
  // own colours (as it was before the band).
  const band = introBand(colors);
  const [cardHeight, setCardHeight] = useState(0);
  const [pastBand, setPastBand] = useState(false);
  const onBand = !pastBand;
  useStatusBarStyle((onBand ? band.isDark : colors.isDark) ? "light" : "dark");

  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );
  const nextUp = useMemo(
    () =>
      upcoming.find(
        (e) =>
          new Date(e.date_time).getTime() >= now && !isHiddenFrom(e, user?.id),
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
          ["moments", relationshipId],
          (current) => {
            if (!current?.pages.length) return current;
            return {
              pages: current.pages.slice(0, 1),
              pageParams: current.pageParams.slice(0, 1),
            };
          },
        );

        await Promise.allSettled([
          queryClient.refetchQueries({
            queryKey: ["moods", relationshipId],
            type: "active",
          }),
          queryClient.refetchQueries({
            queryKey: ["streak", relationshipId],
            type: "active",
          }),
          queryClient.refetchQueries({
            queryKey: ["daily-challenge", relationshipId],
            type: "active",
          }),
          queryClient.refetchQueries({
            queryKey: ["calendar", relationshipId],
            type: "active",
          }),
          queryClient.refetchQueries({
            queryKey: ["calendarUpcoming", relationshipId],
            type: "active",
          }),
          queryClient.refetchQueries({
            queryKey: ["moments", relationshipId],
            type: "active",
          }),
          queryClient.refetchQueries({
            queryKey: ["moodFrequency", relationshipId, user?.id],
            type: "active",
          }),
          queryClient.refetchQueries({
            queryKey: ["latestMessage", relationshipId, user?.id],
            type: "active",
          }),
          queryClient.refetchQueries({
            queryKey: ["unreadMessages", relationshipId, user?.id],
            type: "active",
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
        // On the band: its own text colour (the accent can be the band's colour itself).
        tintColor={band.ink}
        colors={[colors.accent]}
        progressViewOffset={Platform.OS === "android" ? 0 : undefined}
      />
    ),
    [band.ink, colors.accent, onRefresh, refreshing],
  );

  return (
    // Together ← Home → Play (see TabSwipe).
    <TabSwipe
      onSwipeRight={() => openCalendar()}
      onSwipeLeft={() => openActivities()}
    >
      <ScreenContainer padded={false}>
        <AppHeader band={onBand ? band : undefined} />
        <TabScreenScroll
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          onScroll={(e) => {
            const past =
              cardHeight > 0 && e.nativeEvent.contentOffset.y > cardHeight - 12;
            if (past !== pastBand) setPastBand(past);
          }}
          contentContainerStyle={styles.scroll}
        >
          <View onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}>
            <TourTarget name="tour-space">
              <WelcomeCard
                user={user ?? null}
                partner={partner}
                spaceName={relationship?.relationship_name}
                status={session ? streakStatus : null}
                joinedAt={relationship?.created_at}
                band
                onPressPartner={() => openPartnerProfile()}
              />
            </TourTarget>
          </View>

          {/* Evening, not checked in yet: your streak ends at midnight. */}
          {streak ? <StreakAtRiskBanner status={streak} /> : null}
          {restoreStatus ? (
            <StreakRestoreBanner status={restoreStatus} />
          ) : null}

          {!partner ? (
            relationship ? (
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionTitle,
                    colors.sticker && styles.sectionTitleSticker,
                    { color: colors.text },
                  ]}
                  accessibilityRole="header"
                >
                  Invite your person
                </Text>
                <InviteCard />
              </View>
            ) : null
          ) : homePartnerMoments.length > 0 ? (
            <PartnerMomentHome partnerMoments={homePartnerMoments} />
          ) : null}

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                colors.sticker && styles.sectionTitleSticker,
                { color: colors.text },
              ]}
              accessibilityRole="header"
            >
              Today
            </Text>

            <TourTarget name="tour-today">
              <MoodSnapshot
                moods={moods ?? {}}
                onSelectMood={(m) => updateMood.mutate(m)}
                onViewHistory={() => setShowMoodHistory(true)}
              />
            </TourTarget>

            {challenge ? (
              <ActivitiesIntroSection
                challenge={challenge}
                onOpenHistory={() => router.push("/question-history")}
              />
            ) : null}

            {/* Their birthday, from two weeks out. */}
            {user ? <MyBirthdayCard user={user} /> : null}
            {partner ? <PartnerBirthdayCard partner={partner} /> : null}

            {nextUp ? <NextUpCard event={nextUp} viewerId={user?.id} /> : null}

            {/* Shows itself only when there's something to continue. */}
            {session && partner ? <ContinueChatCard /> : null}
          </View>

          {onThisDay ? (
            <OnThisDayCard entry={onThisDay} momentsById={momentsById} />
          ) : null}

          {session && partner ? (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  colors.sticker && styles.sectionTitleSticker,
                  { color: colors.text },
                ]}
                accessibilityRole="header"
              >
                Play
              </Text>
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
  sectionTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  sectionTitleSticker: { fontWeight: "900", letterSpacing: -0.4 },
});
