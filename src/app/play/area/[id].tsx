import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES, type ExploreModalKey } from '@/components/activities/explore/explore-catalog';
import { ExploreActivityModal } from '@/components/activities/explore/ExploreActivityModal';
import { PlayCard } from '@/components/play/PlayCard';
import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { SheetHeader, sheetListStyle } from '@/components/ui/SheetHeader';
import { pressedRowColor, separatorColor } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlayHeader } from '@/components/play/PlayHeader';
import { Icon } from '@/components/ui/Icon';
import { usePackAnswers } from '@/hooks/play-queries';
import { useTheme } from '@/hooks/useTheme';
import { getGameDefinition, type LiveGameKind } from '@/lib/game-room/types';
import {
  DEPTHS,
  FORMATS,
  getArea,
  itemsForArea,
  packProgress,
  type Depth,
  type HandpickedFormat,
  type HandpickedItem,
} from '@/lib/handpicked';
import { useAuthStore } from '@/stores';

/** An Endless game that suits each area, offered at the bottom of its page. */
const AREA_GAME: Record<string, LiveGameKind> = {
  communication: 'guessAnswer',
  intimacy: 'truthDare',
  fun: 'wouldYouRather',
  conflict: 'whosLikely',
  money: 'thisOrThat',
  future: 'thisOrThat',
  family: 'twoTruths',
  growth: 'guessAnswer',
  home: 'whosLikely',
  romance: 'wouldYouRather',
  trust: 'twoTruths',
  distance: 'thisOrThat',
  knowing: 'guessAnswer',
  story: 'quiz',
};

const FORMAT_LABEL: Record<HandpickedFormat, string> = {
  questions: 'Questions',
  quizzes: 'Quiz',
  prompts: 'Prompts',
  activities: 'Activity',
};

export default function AreaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const area = getArea(id ?? '');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: answers } = usePackAnswers();
  const [format, setFormat] = useState<HandpickedFormat | 'all'>('all');
  const [depth, setDepth] = useState<Depth | 'all'>('all');
  const [status, setStatus] = useState<'all' | 'unanswered' | 'answered'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = (depth === 'all' ? 0 : 1) + (status === 'all' ? 0 : 1);
  const [activeModal, setActiveModal] = useState<ExploreModalKey | null>(null);


  const items = useMemo(() => (area ? itemsForArea(area.id) : []), [area]);
  const myAnswered = useMemo(() => {
    const byPack = new Map<string, Set<string>>();
    for (const a of answers ?? []) {
      if (a.user_id !== userId) continue;
      if (!byPack.has(a.pack_id)) byPack.set(a.pack_id, new Set());
      byPack.get(a.pack_id)!.add(a.question_id);
    }
    return byPack;
  }, [answers, userId]);

  if (!area) return <Redirect href="/(tabs)/activities" />;
  const tone = PLAY_TONES[area.tone];

  const packs = items.filter((i): i is Extract<HandpickedItem, { kind: 'pack' }> => i.kind === 'pack');
  const donePacks = packs.filter((p) => packProgress(p.pack, myAnswered.get(p.id) ?? new Set()).done).length;
  const formatsHere = FORMATS.filter((f) => items.some((i) => i.format === f.id));
  const matchesStatus = (item: HandpickedItem) => {
    if (status === 'all') return true;
    if (item.kind !== 'pack') return false;
    const done = packProgress(item.pack, myAnswered.get(item.id) ?? new Set()).done;
    return status === 'answered' ? done : !done;
  };
  const visible = items.filter(
    (i) => (format === 'all' || i.format === format) && (depth === 'all' || i.depth === depth) && matchesStatus(i),
  );
  const game = getGameDefinition(AREA_GAME[area.id] ?? 'wouldYouRather');

  const resetFilters = () => {
    setFormat('all');
    setDepth('all');
    setStatus('all');
  };

  const open = (item: HandpickedItem) => {
    if (item.kind === 'pack') router.push({ pathname: '/play/pack/[id]', params: { id: item.id } });
    else setActiveModal(item.id);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: tone.accent }}>
          <PlayHeader title={area.title} onColor="#FFFFFF" />
        </View>
        <View style={[styles.hero, { backgroundColor: tone.accent }]}>
          <View style={styles.heroBody}>
            <Text style={styles.heroBlurb}>{area.blurb}</Text>
            {packs.length ? (
              <View style={styles.progressRow}>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round((donePacks / packs.length) * 100)}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {donePacks} of {packs.length} packs done
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.filterBar}>
            <Pressable
              onPress={() => setFiltersOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Filters${activeFilters ? `, ${activeFilters} on` : ''}`}
              style={[
                styles.filterBtn,
                {
                  backgroundColor: activeFilters ? colors.accent : colors.surfaceElevated,
                  borderColor: activeFilters ? colors.accent : colors.border,
                },
              ]}>
              <Icon name="filter" size={18} color={activeFilters ? colors.onAccent : colors.text} />
              {activeFilters ? <Text style={[styles.filterCount, { color: colors.onAccent }]}>{activeFilters}</Text> : null}
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
              <Chip label="All" selected={format === 'all'} onPress={() => setFormat('all')} />
              {formatsHere.map((f) => (
                <Chip key={f.id} label={f.label} selected={format === f.id} onPress={() => setFormat(f.id)} />
              ))}
            </ScrollView>
          </View>

          <View style={styles.list}>
            {visible.map((item) => {
              const progress = item.kind === 'pack' ? packProgress(item.pack, myAnswered.get(item.id) ?? new Set()) : null;
              const depthLabel = DEPTHS.find((d) => d.id === item.depth)?.label ?? '';
              const badge = progress?.done
                ? 'Done'
                : progress && progress.answered > 0
                  ? `${progress.answered} of ${progress.total} answered`
                  : undefined;
              return (
                <PlayCard
                  key={`${item.kind}-${item.id}`}
                  tone={tone}
                  art={item.kind === 'pack' ? item.pack.art ?? area.art : item.activity.art}
                  badge={badge ?? `${FORMAT_LABEL[item.format]} · ${depthLabel}`}
                  title={item.title}
                  sub={item.kind === 'pack' ? item.pack.blurb : item.activity.tagline}
                  cta={progress?.done ? 'See answers' : progress && progress.answered > 0 ? 'Continue' : 'Start'}
                  onPress={() => open(item)}
                />
              );
            })}
            {visible.length === 0 ? (
              <EmptyState
                icon={status === 'answered' ? 'checkDone' : status === 'unanswered' ? 'flag' : 'filter'}
                title={
                  status === 'answered'
                    ? 'No answered packs yet'
                    : status === 'unanswered'
                      ? 'All caught up'
                      : 'Nothing matches'
                }
                text={
                  status === 'answered'
                    ? 'Finish a pack and it shows up here.'
                    : status === 'unanswered'
                      ? 'You’ve answered every pack here.'
                      : 'Try a different filter.'
                }
                action={
                  activeFilters || format !== 'all' ? (
                    <Pressable onPress={resetFilters} accessibilityRole="button" hitSlop={8}>
                      <Text style={[styles.reset, { color: colors.accent }]}>Clear filters</Text>
                    </Pressable>
                  ) : null
                }
              />
            ) : null}
          </View>

          <Pressable
            onPress={() => router.push({ pathname: '/play/game/[kind]', params: { kind: game.kind } })}
            accessibilityRole="button"
            style={[styles.gameLink, { borderColor: colors.border }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.gameEyebrow, { color: colors.accent }]}>GAME FOR THIS AREA</Text>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {game.emoji} {game.title}
              </Text>
            </View>
            <Icon name="chevronRight" size={18} color={colors.accent} />
          </Pressable>
        </View>
      </ScrollView>

      <ExploreActivityModal activeModal={activeModal} onClose={() => setActiveModal(null)} />

      <DraggableSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <View style={styles.sheet}>
          <SheetHeader title="Filters" hint="Pick how deep, and what to show." onClose={() => setFiltersOpen(false)} />

          <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>Depth</Text>
          <ChoiceList
            options={[{ id: 'all' as const, label: 'Any' }, ...DEPTHS]}
            value={depth}
            onSelect={(id) => setDepth(id)}
          />

          <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>Show</Text>
          <ChoiceList
            options={[
              { id: 'all' as const, label: 'Everything' },
              { id: 'unanswered' as const, label: 'Unanswered' },
              { id: 'answered' as const, label: 'Answered' },
            ]}
            value={status}
            onSelect={(id) => setStatus(id)}
          />

          <View style={styles.sheetActions}>
            <Pressable onPress={resetFilters} accessibilityRole="button" style={styles.sheetReset}>
              <Text style={[styles.reset, { color: colors.textSecondary }]}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={() => setFiltersOpen(false)}
              accessibilityRole="button"
              style={[styles.sheetDone, { backgroundColor: colors.accent }]}>
              <Text style={[styles.sheetDoneText, { color: colors.onAccent }]}>Show {visible.length} results</Text>
            </Pressable>
          </View>
        </View>
      </DraggableSheet>
    </View>
  );
}

/** One choice from a short list, as on the Settings drawers: an inset list, a ✓ on the one picked. */
function ChoiceList<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onSelect: (id: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={sheetListStyle(colors)}>
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onSelect(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [
              styles.choiceRow,
              i < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: separatorColor(colors) },
              pressed && { backgroundColor: pressedRowColor(colors) },
            ]}>
            <Text style={[styles.choiceLabel, { color: colors.text }, on && styles.choiceLabelOn]}>{o.label}</Text>
            {on ? <Icon name="check" size={20} color={colors.accent} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accent : colors.surfaceElevated,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}>
      <Text style={[styles.chipText, { color: selected ? colors.onAccent : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  choiceRow: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choiceLabel: { fontSize: 16, fontWeight: '600' },
  choiceLabelOn: { fontWeight: '800' },
  hero: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingTop: 10, paddingBottom: 30, minHeight: 150, justifyContent: 'flex-end' },
  heroBody: { paddingHorizontal: 24, gap: 18 },
  heroBlurb: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 27, letterSpacing: -0.3 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  progressText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  body: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: -16 },
  filterBtn: {
    height: 40,
    minWidth: 40,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  filterCount: { fontSize: 13, fontWeight: '800' },
  chipScroll: { flex: 1 },
  chips: { gap: 8, paddingRight: 16 },
  reset: { fontSize: 15, fontWeight: '700' },
  sheet: { gap: 12, paddingBottom: 8 },
  sheetTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  sheetLabel: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  sheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  sheetReset: { height: 50, paddingHorizontal: 8, justifyContent: 'center' },
  sheetDone: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetDoneText: { fontSize: 16, fontWeight: '800' },
  chip: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, height: 40, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '700' },
  list: { gap: 12 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  gameLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginTop: 6,
  },
  gameEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
});
