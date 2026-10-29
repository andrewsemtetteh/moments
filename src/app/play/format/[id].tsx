import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES, type ExploreModalKey } from '@/components/activities/explore/explore-catalog';
import { ExploreActivityModal } from '@/components/activities/explore/ExploreActivityModal';
import { LiveStrip } from '@/components/play/LiveStrip';
import { GameGroups, OwnTimeGames } from '@/components/play/GameList';
import { PackRow, packRowText, useSetProgress } from '@/components/play/PackRow';
import { PlayHeader } from '@/components/play/PlayHeader';
import { PLAY_GUTTER, PlayChip, PlayType } from '@/components/play/PlayKit';
import { useTheme } from '@/hooks/useTheme';
import {
  AREAS,
  itemsForArea,
  itemsWithFormat,
  packProgress,
  type HandpickedFormat,
  type HandpickedItem,
} from '@/lib/handpicked';

type PageId = HandpickedFormat | 'games' | 'all';
type Kind = HandpickedFormat | 'games' | 'everything';

const TITLES: Record<PageId, string> = {
  all: 'Activities',
  games: 'Games',
  questions: 'Questions',
  prompts: 'Cards',
  quizzes: 'Quizzes',
  activities: 'Together',
};

/** Filters on the Activities page (everything at once). */
const KINDS: { id: Kind; label: string }[] = [
  { id: 'everything', label: 'All' },
  { id: 'questions', label: 'Questions' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'prompts', label: 'Cards' },
  { id: 'activities', label: 'Together' },
  { id: 'games', label: 'Games' },
];

/** One kind of play (from the Browse circles), across every area; "all" shows everything with filters. */
export default function FormatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const format = id && id in TITLES ? (id as PageId) : null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [activeModal, setActiveModal] = useState<ExploreModalKey | null>(null);
  const [kind, setKind] = useState<Kind>('everything');

  const groups = useMemo(() => {
    if (!format) return [];
    // The Games page also lists the built-in games (Never Have I Ever and the rest), by area.
    if (format !== 'all') return itemsWithFormat(format);
    return AREAS.map((area) => ({
      area,
      items: itemsForArea(area.id).filter((i) => kind === 'everything' || i.format === kind),
    })).filter((g) => g.items.length > 0);
  }, [format, kind]);
  const showGames = format === 'games' || (format === 'all' && (kind === 'everything' || kind === 'games'));
  // Your answers per set, and who has finished each (both of you, for the rows).
  const { mine: myAnswered, doneByOf } = useSetProgress();

  if (!format) return <Redirect href="/(tabs)/activities" />;

  const open = (item: HandpickedItem) => {
    if (item.kind === 'pack') router.push({ pathname: '/play/pack/[id]', params: { id: item.id } });
    else setActiveModal(item.id);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        // No pull past the top (it showed an empty gap above the page).
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.background }}>
          <PlayHeader title={TITLES[format]} />
        </View>

        <View style={styles.body}>
          {format === 'all' ? (
            <ScrollView
              horizontal
              alwaysBounceHorizontal={false}
              showsHorizontalScrollIndicator={false}
              style={styles.chipBleed}
              contentContainerStyle={styles.chips}>
              {KINDS.map((k) => (
                <PlayChip key={k.id} label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} />
              ))}
            </ScrollView>
          ) : null}
          {/* Games: the Endless games, live or on your own time. */}
          {showGames ? (
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
                <Text style={[PlayType.section, { color: colors.text }]}>{area.title}</Text>
                {items.map((item) => {
                  const progress =
                    item.kind === 'pack' ? packProgress(item.pack, myAnswered.get(item.id) ?? new Set()) : null;
                  // One kind per page, so the kind isn't repeated (except on the mixed Activities page).
                  const { title, meta } = packRowText(item, progress, { withFormat: format === 'all' });
                  return (
                    <PackRow
                      key={`${item.kind}-${item.id}`}
                      tone={tone}
                      format={item.format}
                      title={title}
                      meta={meta}
                      progress={progress}
                      doneBy={doneByOf(item)}
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
  body: { paddingHorizontal: PLAY_GUTTER, paddingTop: 12, gap: 32 },
  // Rows sit close, like a list.
  group: { gap: 10 },
  chipBleed: { marginHorizontal: -PLAY_GUTTER, marginBottom: -16 },
  chips: { gap: 8, paddingHorizontal: PLAY_GUTTER },
});
