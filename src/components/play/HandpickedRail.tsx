import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

import { PLAY_TONES, type ExploreModalKey } from '@/components/activities/explore/explore-catalog';
import { Spacing } from '@/constants/design-system';
import { activitiesWithFormat, featuredPack, getArea } from '@/lib/handpicked';

import { PlayCard } from './PlayCard';

/** Width of a rail card: most of the screen, so the next card peeks in. */
export function useRailCardWidth() {
  const { width } = useWindowDimensions();
  return Math.min(332, width - Spacing.lg * 2 - 38);
}

/** Horizontal rail of ready-made activities of one format; tapping opens the activity. */
export function HandpickedRail({
  format,
  onOpen,
}: {
  format: 'quizzes' | 'prompts' | 'activities';
  onOpen: (key: ExploreModalKey) => void;
}) {
  const cardWidth = useRailCardWidth();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={cardWidth + 12}
      style={styles.bleed}
      contentContainerStyle={styles.rail}>
      {activitiesWithFormat(format).map((a) => (
        <PlayCard
          key={a.id}
          width={cardWidth}
          tone={PLAY_TONES[a.tone]}
          art={a.art}
          title={a.title}
          sub={a.tagline}
          cta={a.cta ?? 'Play'}
          onPress={() => onOpen(a.id)}
        />
      ))}
    </ScrollView>
  );
}

/** Today's question pack, rotating daily. */
export function FeaturedPackCard() {
  const router = useRouter();
  const pack = featuredPack();
  const area = getArea(pack.area);
  if (!area) return null;
  return (
    <PlayCard
      tone={PLAY_TONES[area.tone]}
      art={area.art}
      badge={`Today’s pack · ${area.title}`}
      title={pack.title}
      cta="Start"
      onPress={() => router.push({ pathname: '/play/pack/[id]', params: { id: pack.id } })}
    />
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -Spacing.lg },
  rail: { gap: 12, paddingHorizontal: Spacing.lg, paddingBottom: 6 },
});
