import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { ActivitiesIntroSection } from '@/components/activities/ActivitiesIntroSection';
import { CATALOG_TO_LIVE } from '@/components/activities/explore/explore-catalog';
import { ExploreSection, type ExploreModalKey } from '@/components/activities/ExploreSection';
import { ExploreActivityModal } from '@/components/activities/explore/ExploreActivityModal';
// Experiences marketplace paused — re-enable when backend is ready.
// import { ExperiencesSection } from '@/components/activities/ExperiencesSection';
import { BadgesShelf, LiveRoomSection, QuestsCard, startLiveRoom } from '@/components/games/PlayHub';
import { PlayModeSheet } from '@/components/games/PlayModeSheet';
import { PromptHistoryModal } from '@/components/home/PromptHistoryModal';
import { AppHeader } from '@/components/layout/AppHeader';
import { TabSwipe } from '@/components/layout/TabSwipe';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { Spacing } from '@/constants/design-system';
import { useDailyChallenge, useRealtimeSubscription } from '@/hooks/queries';
import type { LiveGameKind } from '@/lib/game-room/types';
import * as api from '@/services/api';
import { useRelationshipStore } from '@/stores';

const EXPLORE_MODAL_KEYS = new Set<string>([
  'cards',
  'games',
  'quiz',
  'bucket',
  'goals',
  'gratitude',
  'daily',
  'trivia',
  'quizLive',
  'compliment',
  'twoTruths',
  'truth',
  'memory',
  'playlist',
  'thisOrThat',
  'wouldYouRather',
  'whosLikely',
  'loveQuiz',
  'neverHaveI',
  'finishSentence',
  'emojiStory',
  'appreciation',
  'thirtySix',
  'weekChallenge',
  'dateNight',
  'fortuneWheel',
  'dateGenerator',
  'drawTogether',
  'compatibility',
  'personality',
  'attachment',
  'guessAnswer',
]);

export default function ActivitiesScreen() {
  const { open } = useLocalSearchParams<{ open?: string }>();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: challenge } = useDailyChallenge();
  const [activeModal, setActiveModal] = useState<ExploreModalKey | null>(null);
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const [modeChoice, setModeChoice] = useState<ExploreModalKey | null>(null);
  const modeGame = modeChoice ? (CATALOG_TO_LIVE[modeChoice] ?? null) : null;

  /** Cards with a live version ask how you want to play; the rest open straight away. */
  const openActivity = (key: ExploreModalKey) => {
    if (CATALOG_TO_LIVE[key]) setModeChoice(key);
    else setActiveModal(key);
  };

  // Let the sheet finish sliding away before the next full-screen surface opens.
  const afterSheet = (action: () => void) => {
    setModeChoice(null);
    setTimeout(action, 340);
  };

  useRealtimeSubscription('activities');
  useRealtimeSubscription('daily_challenges');

  useEffect(() => {
    if (!open || !EXPLORE_MODAL_KEYS.has(open)) return;
    setActiveModal(open as ExploreModalKey);
  }, [open]);

  const addToCalendar = async (title: string) => {
    if (!relationship) return;
    await api.createCalendarEvent(relationship.id, {
      title,
      date_time: new Date(Date.now() + 86400000).toISOString(),
      type: 'date',
      source: 'activity',
      description: null,
    });
    Alert.alert('Added to calendar', `"${title}" is planned for tomorrow. Edit the time in Calendar.`);
  };

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
          partnerName={partner?.name}
          onOpenHistory={() => setShowPromptHistory(true)}
        />

        <LiveRoomSection />
        <QuestsCard />
        <BadgesShelf />

        <ExploreSection onOpen={openActivity} />

        {/* Experiences marketplace paused — re-enable when backend is ready.
        <ExperiencesSection onAddToCalendar={addToCalendar} />
        */}
      </TabScreenScroll>

      <ExploreActivityModal
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        onAddToCalendar={addToCalendar}
      />

      <PlayModeSheet
        game={modeGame}
        onClose={() => setModeChoice(null)}
        onLive={(game: LiveGameKind) => afterSheet(() => startLiveRoom(game))}
        onLocal={() => {
          const key = modeChoice;
          if (key) afterSheet(() => setActiveModal(key));
        }}
        localLabel={modeChoice === 'quizLive' ? '📱  Classic quiz (no voice)' : '📱  On this phone'}
      />

      <PromptHistoryModal visible={showPromptHistory} onClose={() => setShowPromptHistory(false)} />
    </ScreenContainer>
    </TabSwipe>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.lg,
  },
});
