import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActivitiesIntroSection } from '@/components/activities/ActivitiesIntroSection';
import { PLAY_ACTIVITIES, type ExploreModalKey } from '@/components/activities/explore/explore-catalog';
import { ExploreActivityModal } from '@/components/activities/explore/ExploreActivityModal';
import { BadgesShelf, PlayHero, QuestsCard } from '@/components/games/PlayHub';
import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { TabSwipe } from '@/components/layout/TabSwipe';
import { AreaGrid } from '@/components/play/AreaGrid';
import { BrowseRow } from '@/components/play/BrowseRow';
import { GameGroups, GameRail, OwnTimeGames } from '@/components/play/GameList';
import { FeaturedPackCard, HandpickedRail } from '@/components/play/HandpickedRail';
import { LiveStrip } from '@/components/play/LiveStrip';
import { PlayTabs, type PlayTab } from '@/components/play/PlayTabs';
import { Spacing } from '@/constants/design-system';
import { useDailyChallenge, useRealtimeSubscription } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { LIVE_GAMES } from '@/lib/game-room/types';

const EXPLORE_MODAL_KEYS = new Set<string>(PLAY_ACTIVITIES.map((a) => a.id));
const LIVE_GAME_KINDS = new Set<string>(LIVE_GAMES.map((g) => g.kind));

export default function ActivitiesScreen() {
  const { open, tab: tabParam } = useLocalSearchParams<{ open?: string; tab?: string }>();
  const {
    data: challenge,
    isLoading: challengeLoading,
    isFetching: challengeFetching,
    refetch: refetchChallenge,
  } = useDailyChallenge();
  const [tab, setTab] = useState<PlayTab>('all');
  const [activeModal, setActiveModal] = useState<ExploreModalKey | null>(null);
  const [seenParams, setSeenParams] = useState<{ open?: string; tab?: string }>({});

  useRealtimeSubscription('activities');
  useRealtimeSubscription('daily_challenges');

  // Deep links (`?open=<activity>`, `?tab=<tab>`) apply once per new value; the tab stays mounted.
  if (open !== seenParams.open || tabParam !== seenParams.tab) {
    setSeenParams({ open, tab: tabParam });
    if (open && open !== seenParams.open && EXPLORE_MODAL_KEYS.has(open)) setActiveModal(open as ExploreModalKey);
    if (tabParam === 'all' || tabParam === 'handpicked' || tabParam === 'endless') setTab(tabParam);
  }

  // `?open=<game>` jumps to that game's setup screen.
  useEffect(() => {
    if (open && LIVE_GAME_KINDS.has(open)) {
      router.push({ pathname: '/play/game/[kind]', params: { kind: open as (typeof LIVE_GAMES)[number]['kind'] } });
    }
  }, [open]);

  return (
    // Home ← Play → You (see TabSwipe).
    <TabSwipe
      onSwipeRight={() => router.navigate('/(tabs)/home')}
      onSwipeLeft={() => router.navigate('/(tabs)/profile')}>
      <ScreenContainer padded={false}>
        <AppHeader />
        <TabScreenScroll showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ActivitiesIntroSection
            challenge={challenge}
            loading={challengeLoading || challengeFetching}
            onRetry={() => void refetchChallenge()}
            onOpenHistory={() => router.push('/question-history')}
          />

          <View style={styles.browse}>
            <BrowseRow />
          </View>

          <View style={styles.tabs}>
            <PlayTabs value={tab} onChange={setTab} />
          </View>

          {tab === 'all' ? (
            <View style={styles.stack}>
              <Section title="Today’s pack">
                <FeaturedPackCard />
              </Section>
              <Section title="Handpicked" onSeeAll={() => setTab('handpicked')}>
                <AreaGrid />
              </Section>
              <Section title="Endless" onSeeAll={() => setTab('endless')}>
                <LiveStrip />
                <OwnTimeGames />
                <GameRail />
              </Section>
              <Section title="Your progress">
                <PlayHero />
                <QuestsCard />
                <BadgesShelf />
              </Section>
            </View>
          ) : null}

          {tab === 'handpicked' ? (
            <View style={styles.stack}>
              <Section title="Areas">
                <AreaGrid />
              </Section>
              <Section title="Today’s pack">
                <FeaturedPackCard />
              </Section>
              <Section title="Quizzes to take together">
                <HandpickedRail format="quizzes" onOpen={setActiveModal} />
              </Section>
              <Section title="Prompts and cards">
                <HandpickedRail format="prompts" onOpen={setActiveModal} />
              </Section>
              <Section title="Things to do together">
                <HandpickedRail format="activities" onOpen={setActiveModal} />
              </Section>
            </View>
          ) : null}

          {tab === 'endless' ? (
            <View style={styles.stack}>
              <LiveStrip />
              <OwnTimeGames />
              <GameGroups />
            </View>
          ) : null}
        </TabScreenScroll>

        <ExploreActivityModal activeModal={activeModal} onClose={() => setActiveModal(null)} />
      </ScreenContainer>
    </TabSwipe>
  );
}

function Section({ title, onSeeAll, children }: { title: string; onSeeAll?: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        </View>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.seeAll, { color: colors.accent }]}>See all</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
  },
  browse: { marginTop: 32 },
  tabs: { marginTop: 32, marginBottom: 4 },
  stack: { gap: 36, marginTop: 24 },
  section: { gap: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  sectionTitle: { fontSize: 23, fontWeight: '900', letterSpacing: -0.4 },
  seeAll: { fontSize: 14, fontWeight: '800' },
});
