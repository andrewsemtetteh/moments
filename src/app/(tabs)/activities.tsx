import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { ActivitiesIntroSection } from '@/components/activities/ActivitiesIntroSection';
import { ExploreSection, type ExploreModalKey } from '@/components/activities/ExploreSection';
import { ExploreActivityModal } from '@/components/activities/explore/ExploreActivityModal';
// Experiences marketplace paused — re-enable when backend is ready.
// import { ExperiencesSection } from '@/components/activities/ExperiencesSection';
import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { Spacing } from '@/constants/design-system';
import { useDailyChallenge, useRealtimeSubscription } from '@/hooks/queries';
import * as api from '@/services/api';
import { useRelationshipStore } from '@/stores';

export default function ActivitiesScreen() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: challenge } = useDailyChallenge();
  const [activeModal, setActiveModal] = useState<ExploreModalKey | null>(null);

  useRealtimeSubscription('activities');

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
    <ScreenContainer padded={false}>
      <AppHeader />
      <TabScreenScroll showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ActivitiesIntroSection
          challengePrompt={challenge?.prompt}
          partnerName={partner?.name}
          onQuickOpen={setActiveModal}
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
