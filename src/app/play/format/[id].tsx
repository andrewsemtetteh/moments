import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES, type ExploreModalKey } from '@/components/activities/explore/explore-catalog';
import { ExploreActivityModal } from '@/components/activities/explore/ExploreActivityModal';
import { LiveStrip } from '@/components/play/LiveStrip';
import { GameGroups, OwnTimeGames } from '@/components/play/GameList';
import { PlayCard } from '@/components/play/PlayCard';
import { PlayHeader } from '@/components/play/PlayHeader';
import { usePackAnswers } from '@/hooks/play-queries';
import { useTheme } from '@/hooks/useTheme';
import { DEPTHS, itemsWithFormat, packProgress, type HandpickedFormat, type HandpickedItem } from '@/lib/handpicked';
import { useAuthStore } from '@/stores';

const TITLES: Record<HandpickedFormat | 'games', string> = {
  games: 'Games',
  questions: 'Questions',
  prompts: 'Cards',
  quizzes: 'Quizzes',
  activities: 'Together',
};

/** One kind of play (from the Browse circles), across every area. */
export default function FormatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const format = id && id in TITLES ? (id as HandpickedFormat | 'games') : null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: answers } = usePackAnswers();
  const [activeModal, setActiveModal] = useState<ExploreModalKey | null>(null);

  const groups = useMemo(() => (format && format !== 'games' ? itemsWithFormat(format) : []), [format]);
  const myAnswered = useMemo(() => {
    const byPack = new Map<string, Set<string>>();
    for (const a of answers ?? []) {
      if (a.user_id !== userId) continue;
      if (!byPack.has(a.pack_id)) byPack.set(a.pack_id, new Set());
      byPack.get(a.pack_id)!.add(a.question_id);
    }
    return byPack;
  }, [answers, userId]);

  if (!format) return <Redirect href="/(tabs)/activities" />;

  const open = (item: HandpickedItem) => {
    if (item.kind === 'pack') router.push({ pathname: '/play/pack/[id]', params: { id: item.id } });
    else setActiveModal(item.id);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.background }}>
          <PlayHeader title={TITLES[format]} />
        </View>

        <View style={styles.body}>
          {/* Games: the Endless games, live or on your own time. */}
          {format === 'games' ? (
            <View style={styles.group}>
              <LiveStrip />
              <OwnTimeGames />
              <GameGroups />
            </View>
          ) : null}
          {groups.map(({ area, items }) => {
            const tone = PLAY_TONES[area.tone];
            return (
              <View key={area.id} style={styles.group}>
                <Text style={[styles.groupTitle, { color: colors.text }]}>{area.title}</Text>
                {items.map((item) => {
                  const progress =
                    item.kind === 'pack' ? packProgress(item.pack, myAnswered.get(item.id) ?? new Set()) : null;
                  const depthLabel = DEPTHS.find((d) => d.id === item.depth)?.label ?? '';
                  const badge = progress?.done
                    ? 'Done'
                    : progress && progress.answered > 0
                      ? `${progress.answered} of ${progress.total} answered`
                      : depthLabel;
                  return (
                    <PlayCard
                      key={`${item.kind}-${item.id}`}
                      tone={tone}
                      art={item.kind === 'pack' ? area.art : item.activity.art}
                      badge={badge}
                      title={item.title}
                      sub={item.kind === 'pack' ? undefined : item.activity.tagline}
                      cta={progress?.done ? 'See answers' : progress && progress.answered > 0 ? 'Continue' : 'Start'}
                      onPress={() => open(item)}
                    />
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <ExploreActivityModal activeModal={activeModal} onClose={() => setActiveModal(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 16, paddingTop: 12, gap: 32 },
  group: { gap: 12 },
  groupTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
});
