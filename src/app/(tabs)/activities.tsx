import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { ActivitiesIntroSection } from '@/components/activities/ActivitiesIntroSection';
import { ExploreSection, type ExploreModalKey } from '@/components/activities/ExploreSection';
import { ExploreActivityModal } from '@/components/activities/explore/ExploreActivityModal';
// Experiences marketplace paused — re-enable when backend is ready.
// import { ExperiencesSection } from '@/components/activities/ExperiencesSection';
import { PromptHistoryModal } from '@/components/home/PromptHistoryModal';
import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { Spacing } from '@/constants/design-system';
import { useDailyChallenge, useRealtimeSubscription } from '@/hooks/queries';
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
    <ScreenContainer padded={false} tabSwipe>
      <AppHeader />
      <TabScreenScroll showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ActivitiesIntroSection
          challenge={challenge}
          partnerName={partner?.name}
          onOpenHistory={() => setShowPromptHistory(true)}
        />

        <ExploreSection onOpen={setActiveModal} />

        {/* Experiences marketplace paused — re-enable when backend is ready.
        <ExperiencesSection onAddToCalendar={addToCalendar} />
        */}
      </TabScreenScroll>

      <ExploreActivityModal
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        onAddToCalendar={addToCalendar}
      />

      <PromptHistoryModal visible={showPromptHistory} onClose={() => setShowPromptHistory(false)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.lg,
  },
});
