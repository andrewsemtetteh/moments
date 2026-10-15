import { format, formatDistanceToNowStrict, getYear, isToday, startOfDay, subDays } from 'date-fns';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';

import { memoryPhotos } from '@/components/calendar/plan/MemorySheets';
import { Icon } from '@/components/ui/Icon';
import { colorWithAlpha, paperEdge } from '@/components/ui/primitives';
import { StreakFlame } from '@/components/home/StreakFlame';
import { useTheme } from '@/hooks/useTheme';
import { MEMORY_TINT, MEMORY_TYPES, memoryTypeMeta, parsePlanMeta, type MemoryType } from '@/lib/plan-meta';
import type { CalendarEvent, Moment } from '@/types/database';

/** "All", the memory types, and Photos. */
type Filter = 'all' | 'photos' | MemoryType;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  ...MEMORY_TYPES.map((t) => ({ key: t.key, label: t.label })),
  { key: 'photos', label: 'Photos' },
];

/** A busy moments day the app offers to turn into a memory. */
export type MemorySuggestion = { key: string; date: Date; moments: Moment[] };

type Item =
  | { kind: 'memory'; key: string; date: Date; entry: CalendarEvent; photos: string[] }
  | { kind: 'suggestion'; key: string; date: Date; suggestion: MemorySuggestion }
  | { kind: 'streak'; key: string; date: Date; days: number }
  | { kind: 'together'; key: string; date: Date };

const STREAK_MILESTONES = [365, 200, 100, 50, 30] as const;
/** Below this many memories, scrolling beats searching — the box stays hidden. */
const SEARCH_MIN_MEMORIES = 10;
const SUGGEST_MIN_MOMENTS = 4;
const SUGGEST_DAYS_BACK = 60;

/** Days with lots of moments that no memory covers yet (newest first, max 2). */
export function buildSuggestions(
  moments: Moment[],
  memories: CalendarEvent[],
  dismissed: Set<string>,
): MemorySuggestion[] {
  const covered = new Set(memories.map((m) => format(new Date(m.date_time), 'yyyy-MM-dd')));
  const since = subDays(new Date(), SUGGEST_DAYS_BACK);
  const byDay = new Map<string, Moment[]>();
  for (const m of moments) {
    const at = new Date(m.created_at);
    if (at < since || isToday(at)) continue;
    const key = format(at, 'yyyy-MM-dd');
    byDay.set(key, [...(byDay.get(key) ?? []), m]);
  }
  return [...byDay.entries()]
    .filter(([key, ms]) => ms.length >= SUGGEST_MIN_MOMENTS && !covered.has(key) && !dismissed.has(key))
    .map(([key, ms]) => ({ key, date: startOfDay(new Date(ms[0].created_at)), moments: ms }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 2);
}

export function PlanMemoriesTab({
  memories,
  momentsById,
  suggestions,
  anniversaryDate,
  currentStreak,
  onOpen,
  onAcceptSuggestion,
  onDismissSuggestion,
}: {
  memories: CalendarEvent[];
  momentsById: Map<string, Moment>;
  suggestions: MemorySuggestion[];
  anniversaryDate: string | null | undefined;
  currentStreak: number;
  onOpen: (entry: CalendarEvent) => void;
  onAcceptSuggestion: (s: MemorySuggestion) => void;
  onDismissSuggestion: (s: MemorySuggestion) => void;
}) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const q = query.trim().toLowerCase();

  const items = useMemo(() => {
    const matchesQuery = (it: { entry: CalendarEvent; date: Date }) => {
      if (!q) return true;
      const m = parsePlanMeta(it.entry.description);
      return [it.entry.title, m.notes, m.placeName, format(it.date, 'MMMM yyyy')]
        .filter(Boolean)
        .some((t) => t!.toLowerCase().includes(q));
    };

    const memoryItems: Item[] = memories
      .map((entry) => ({
        kind: 'memory' as const,
        key: entry.id,
        date: new Date(entry.date_time),
        entry,
        photos: memoryPhotos(entry, momentsById),
      }))
      .filter((it) => {
        const meta = parsePlanMeta(it.entry.description);
        if (filter === 'photos') return it.photos.length > 0 && matchesQuery(it);
        if (filter !== 'all' && meta.memoryType !== filter) return false;
        return matchesQuery(it);
      });

    // App-made entries: only on the unfiltered, unsearched timeline.
    const auto: Item[] = [];
    if (!q && filter === 'all') {
      for (const s of suggestions) auto.push({ kind: 'suggestion', key: `s-${s.key}`, date: s.date, suggestion: s });
      const reached = STREAK_MILESTONES.find((m) => currentStreak >= m);
      if (reached) {
        auto.push({ kind: 'streak', key: `streak-${reached}`, date: subDays(new Date(), currentStreak - reached), days: reached });
      }
    }
    if (!q && (filter === 'all' || filter === 'milestone') && anniversaryDate) {
      auto.push({ kind: 'together', key: 'together', date: new Date(anniversaryDate) });
    }

    return [...memoryItems, ...auto].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [memories, momentsById, suggestions, anniversaryDate, currentStreak, filter, q]);

  const thisYear = getYear(new Date());

  const showSearch = memories.length >= SEARCH_MIN_MEMORIES || !!query;

  return (
    <View style={styles.root}>
      {showSearch ? (
      <View style={[styles.search, { backgroundColor: colors.surface }, paperEdge(colors)]}>
        <Icon name="search" size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search memories, places…"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="search"
          accessibilityLabel="Search memories"
          style={[styles.searchInput, { color: colors.text }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
            <Icon name="close" size={16} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      ) : null}

      {/* As in the design: plain text pills in one row that scrolls sideways. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[
                styles.chip,
                { backgroundColor: on ? colors.text : colors.surface, borderColor: on ? colors.text : colors.border },
              ]}>
              <Text style={[styles.chipText, { color: on ? colors.background : colors.text }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
            <Icon name={q ? 'search' : 'heart'} size={28} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{q ? 'No memories found' : 'No memories yet'}</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            {q
              ? 'Try a place, a month, or a word from a note.'
              : 'Add your first date, the day it became official, or a trip you loved.'}
          </Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          <View style={[styles.rail, { backgroundColor: colors.border }]} />
          {items.map((it, i) => {
            const year = getYear(it.date);
            const prevYear = i > 0 ? getYear(items[i - 1].date) : thisYear;
            const yearLabel = year !== prevYear ? (
              <Text key={`y-${year}-${it.key}`} style={[styles.year, { color: colors.textSecondary, backgroundColor: colors.background }]}>
                {year}
              </Text>
            ) : null;
            return (
              <View key={it.key}>
                {yearLabel}
                <TimelineRow item={it} onOpen={onOpen} onAccept={onAcceptSuggestion} onDismiss={onDismissSuggestion} />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function TimelineRow({
  item,
  onOpen,
  onAccept,
  onDismiss,
}: {
  item: Item;
  onOpen: (entry: CalendarEvent) => void;
  onAccept: (s: MemorySuggestion) => void;
  onDismiss: (s: MemorySuggestion) => void;
}) {
  const { colors } = useTheme();

  if (item.kind === 'streak') {
    return (
      <View style={styles.row}>
        <View style={[styles.smallDot, { backgroundColor: colors.textTertiary }]} />
        <StreakFlame size={16} tone="active" />
        <Text style={[styles.smallText, { color: colors.text }]}>
          {item.days}-day streak <Text style={{ color: colors.textTertiary }}>· {format(item.date, 'MMM d')}</Text>
        </Text>
      </View>
    );
  }

  if (item.kind === 'together') {
    return (
      <View style={styles.row}>
        <View style={[styles.bigDot, { backgroundColor: colors.accent, borderColor: colors.accentSoft }]} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.kicker, { color: colors.accent }]}>Milestone</Text>
          <View style={styles.titleRow}>
            <Icon name="heart" size={16} color={colors.accent} filled />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Together since</Text>
          </View>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{format(item.date, 'd MMMM yyyy')}</Text>
        </View>
      </View>
    );
  }

  if (item.kind === 'suggestion') {
    const s = item.suggestion;
    const thumbs = s.moments.filter((m) => m.media_url && m.type === 'photo').slice(0, 3);
    const extra = s.moments.length - thumbs.length;
    return (
      <View style={styles.row}>
        <View style={[styles.dot, styles.dotDashed, { borderColor: colors.accent, backgroundColor: colors.background }]} />
        <View style={[styles.card, styles.suggestion, { borderColor: colors.accent }]}>
          <View style={styles.cardHead}>
            <View style={styles.titleRow}>
              <Icon name="albums" size={16} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>{s.moments.length} moments</Text>
            </View>
            <Text style={[styles.cardSub, { color: colors.textTertiary }]}>{format(s.date, 'MMM d')}</Text>
          </View>
          <View style={styles.thumbs}>
            {thumbs.map((m) => (
              <Image key={m.id} source={{ uri: m.media_url! }} style={styles.thumb} contentFit="cover" />
            ))}
            {extra > 0 ? (
              <View style={[styles.thumb, styles.more, { backgroundColor: colors.surface }, paperEdge(colors)]}>
                <Text style={[styles.moreText, { color: colors.textSecondary }]}>+{extra}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => onAccept(s)} style={[styles.pill, { backgroundColor: colors.accent }]}>
              <Text style={[styles.pillText, { color: colors.onAccent }]}>Add as memory</Text>
            </Pressable>
            <Pressable onPress={() => onDismiss(s)} style={[styles.pill, { backgroundColor: colors.surface }, paperEdge(colors)]}>
              <Text style={[styles.pillText, { color: colors.text }]}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const meta = parsePlanMeta(item.entry.description);
  const type = memoryTypeMeta(meta.memoryType);
  const isMilestone = meta.memoryType === 'milestone';
  const cover = item.photos[0];
  const tint = MEMORY_TINT[meta.memoryType ?? 'justus'] ?? colors.accent;

  return (
    <Pressable
      onPress={() => onOpen(item.entry)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View
        style={[
          isMilestone ? styles.bigDot : styles.dot,
          { backgroundColor: tint, borderColor: isMilestone ? colorWithAlpha(tint, 0.25) : 'transparent' },
        ]}
      />
      {isMilestone ? (
        <View style={[styles.card, styles.milestone, { backgroundColor: colors.surface }]}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.banner} contentFit="cover" />
          ) : (
            // No photo: a flat band in the milestone's colour with its emoji and year, so it still reads big.
            <View style={[styles.bannerEmpty, { backgroundColor: colorWithAlpha(tint, colors.isDark ? 0.3 : 0.18) }]}>
              <Text style={styles.bannerEmoji}>{type.emoji}</Text>
              <Text style={[styles.bannerYear, { color: colors.text }]}>{format(item.date, 'yyyy')}</Text>
            </View>
          )}
          <View style={styles.milestoneBody}>
            <Text style={[styles.kicker, { color: colors.accent }]}>Milestone</Text>
            <View style={styles.titleRow}>
              <Icon name={type.icon} size={16} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {item.entry.title}
              </Text>
            </View>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{format(item.date, 'd MMM yyyy')}</Text>
          </View>
        </View>
      ) : cover ? (
        <View style={[styles.card, styles.memory, { backgroundColor: colors.surface }, paperEdge(colors)]}>
          <Image source={{ uri: cover }} style={styles.memoryThumb} contentFit="cover" />
          <View style={styles.memoryText}>
            <View style={styles.titleRow}>
              <Icon name={type.icon} size={16} color={tint} />
              <Text style={[styles.cardTitle, styles.flexShrink, { color: colors.text }]} numberOfLines={1}>
                {item.entry.title}
              </Text>
            </View>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {format(item.date, 'MMM d')}
              {meta.placeName ? ` · ${meta.placeName}` : ''}
            </Text>
            {meta.notes ? (
              <Text style={[styles.quote, { color: colors.text }]} numberOfLines={1}>
                “{meta.notes}”
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        // No photo: a story card as substantial as a photo memory (after Apple Journal / Day One): a flat
        // wash of the memory's colour, a big date, the title, the note as a pull-quote, the tags at the
        // foot, and the type's emoji large in the corner so even a title-only memory has presence.
        <View
          style={[
            styles.card,
            styles.story,
            {
              backgroundColor: colorWithAlpha(tint, colors.isDark ? 0.2 : 0.12),
              borderColor: colors.boldBorder ? colors.border : colorWithAlpha(tint, 0.3),
              borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
            },
          ]}>
          <Text style={styles.storyWatermark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {type.emoji}
          </Text>

          <View style={styles.storyTop}>
            <View style={styles.storyDate}>
              <Text style={[styles.storyDay, { color: colors.text }]}>{format(item.date, 'd')}</Text>
              <View>
                <Text style={[styles.storyMonth, { color: colors.text }]}>{format(item.date, 'MMMM')}</Text>
                <Text style={[styles.storyWeekday, { color: colors.textSecondary }]}>{format(item.date, 'EEEE')}</Text>
              </View>
            </View>
            <View style={[styles.storyAgo, { backgroundColor: colors.surface }, paperEdge(colors, 1.5)]}>
              <Text style={[styles.storyAgoText, { color: colors.textSecondary }]} numberOfLines={1}>
                {isToday(item.date) ? 'Today' : formatDistanceToNowStrict(item.date, { addSuffix: true })}
              </Text>
            </View>
          </View>

          <Text style={[styles.storyTitle, { color: colors.text }]} numberOfLines={3}>
            {item.entry.title}
          </Text>

          {meta.notes ? (
            <View style={styles.storyQuote}>
              <View style={[styles.storyQuoteBar, { backgroundColor: tint }]} />
              <Text style={[styles.storyNote, { color: colors.text }]} numberOfLines={4}>
                {meta.notes}
              </Text>
            </View>
          ) : null}

          <View style={styles.storyTags}>
            <View style={[styles.postcardTag, { backgroundColor: colors.surface }, paperEdge(colors, 1.5)]}>
              <Icon name={type.icon} size={13} color={tint} />
              <Text style={[styles.postcardTagText, { color: colors.text }]}>{type.label}</Text>
            </View>
            {meta.placeName ? (
              <View style={[styles.postcardTag, { backgroundColor: colors.surface }, paperEdge(colors, 1.5)]}>
                <Icon name="location" size={13} color={colors.textSecondary} />
                <Text style={[styles.postcardTagText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {meta.placeName}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}


const RAIL_X = 11;

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12 },
  pressed: { opacity: 0.75 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 14 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  // flexGrow 0: a horizontal ScrollView otherwise stretches to fill the tab's height.
  chipsScroll: { flexGrow: 0, marginHorizontal: -16 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 14, fontWeight: '700' },
  timeline: { paddingLeft: 34, paddingTop: 6, gap: 16 },
  rail: { position: 'absolute', left: RAIL_X, top: 10, bottom: 0, width: 2 },
  year: { marginLeft: -34, marginBottom: 12, paddingVertical: 4, fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { position: 'absolute', left: -29, top: 14, width: 12, height: 12, borderRadius: 6 },
  dotDashed: { borderWidth: 2, borderStyle: 'dashed' },
  bigDot: { position: 'absolute', left: -31, top: 12, width: 16, height: 16, borderRadius: 8, borderWidth: 4 },
  smallDot: { position: 'absolute', left: -27, top: 6, width: 8, height: 8, borderRadius: 4 },
  smallText: { fontSize: 14, fontWeight: '700', marginLeft: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  flexShrink: { flexShrink: 1 },
  card: { flex: 1, borderRadius: 18 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardSub: { fontSize: 13, fontWeight: '600' },
  kicker: { fontSize: 13, fontWeight: '800' },
  suggestion: { borderWidth: 1, borderStyle: 'dashed', padding: 12, gap: 10 },
  thumbs: { flexDirection: 'row', gap: 6 },
  thumb: { width: 52, height: 52, borderRadius: 14 },
  more: { alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
  pill: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center' },
  pillText: { fontSize: 13, fontWeight: '800' },
  milestone: { overflow: 'hidden' },
  banner: { height: 120 },
  milestoneBody: { padding: 12, gap: 3 },
  memory: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  memoryThumb: { width: 64, height: 64, borderRadius: 16 },
  // A note reads like a quote, in a serif: for text-only memories it's the main content.
  quote: {
    fontSize: 14,
    lineHeight: 19,
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    marginTop: 2,
  },
  story: { minHeight: 176, padding: 16, gap: 10, borderRadius: 22, overflow: 'hidden' },
  storyWatermark: {
    position: 'absolute',
    right: -6,
    bottom: -14,
    fontSize: 104,
    opacity: 0.16,
    transform: [{ rotate: '-12deg' }],
  },
  storyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  storyDate: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  storyDay: { fontSize: 40, fontWeight: '900', letterSpacing: -1.5, lineHeight: 44 },
  storyMonth: { fontSize: 15, fontWeight: '800' },
  storyWeekday: { fontSize: 13, fontWeight: '600' },
  storyAgo: { height: 28, paddingHorizontal: 11, borderRadius: 14, justifyContent: 'center', maxWidth: '45%' },
  storyAgoText: { fontSize: 12, fontWeight: '800' },
  storyTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, lineHeight: 27 },
  storyQuote: { flexDirection: 'row', gap: 10 },
  storyQuoteBar: { width: 3, borderRadius: 2 },
  storyNote: {
    flex: 1,
    fontSize: 16,
    lineHeight: 23,
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  },
  // Pinned to the foot of the card, so short memories keep their tags at the bottom.
  storyTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 'auto', paddingTop: 4 },
  postcardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    maxWidth: '100%',
  },
  postcardTagText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  bannerEmpty: { height: 110, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  bannerEmoji: { fontSize: 52 },
  bannerYear: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  memoryText: { flex: 1, minWidth: 0, gap: 3 },
  // Fills the space under the filters and centers in it.
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingBottom: 60 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
