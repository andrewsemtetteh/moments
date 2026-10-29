import {
  addDays,
  differenceInCalendarDays,
  format,
  getYear,
  intervalToDuration,
  isToday,
  startOfDay,
  subDays,
} from 'date-fns';
import { Image } from 'expo-image';
import { thumbUrl, mediaSource } from '@/lib/storage-cdn';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';

import { memoryPhotos } from '@/components/calendar/plan/MemorySheets';
import { PlanEmptyState } from '@/components/calendar/plan/PlanAgendaList';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, cardEdge, colorWithAlpha, paperEdge, separatorColor, trackColor, outlineColor, cardSurface } from '@/components/ui/primitives';
import { getFirstName } from '@/lib/avatar-initial';
import { StreakFlame } from '@/components/home/StreakFlame';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { MEMORY_TYPES, memoryTone, memoryTypeMeta, parsePlanMeta, type MemoryType } from '@/lib/plan-meta';
import type { CalendarEvent, Moment } from '@/types/database';

/** "All", the memory types, and Photos. */
type Filter = 'all' | 'photos' | MemoryType;
const FILTERS: { key: Filter; label: string; icon: IconName }[] = [
  { key: 'all', label: 'All', icon: 'albums' },
  ...MEMORY_TYPES.map((t) => ({ key: t.key, label: t.label, icon: t.icon })),
  { key: 'photos', label: 'Photos', icon: 'image' },
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
  onEmptyChange,
}: {
  memories: CalendarEvent[];
  momentsById: Map<string, Moment>;
  suggestions: MemorySuggestion[];
  anniversaryDate: string | null | undefined;
  currentStreak: number;
  onOpen: (entry: CalendarEvent) => void;
  onAcceptSuggestion: (s: MemorySuggestion) => void;
  onDismissSuggestion: (s: MemorySuggestion) => void;
  /** Whether the empty state is showing (the page then stays still, if it fits). */
  onEmptyChange?: (empty: boolean) => void;
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

  const empty = items.length === 0;
  useEffect(() => {
    onEmptyChange?.(empty);
  }, [empty, onEmptyChange]);

  const thisYear = getYear(new Date());

  const showSearch = memories.length >= SEARCH_MIN_MEMORIES || !!query;

  return (
    <View style={styles.root}>
      {showSearch ? (
      <View style={[styles.search, cardSurface(colors)]}>
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
        alwaysBounceHorizontal={false}
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
                on ? { backgroundColor: colors.accent, borderColor: colors.accent, borderWidth: cardSurface(colors).borderWidth } : cardSurface(colors),
              ]}>
              <Icon name={f.icon} size={18} color={on ? colors.onAccent : colors.text} />
              <Text style={[styles.chipText, { color: on ? colors.onAccent : colors.text }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {items.length === 0 ? (
        // The Plan tab's empty state (a theme card, centred), so both tabs match.
        <View style={styles.empty}>
          <PlanEmptyState
            icon={q ? 'search' : filter === 'photos' ? 'image' : filter === 'all' ? 'heart' : memoryTypeMeta(filter).icon}
            title={
              q
                ? 'No memories found'
                : filter === 'all'
                  ? 'No memories yet'
                  : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} memories yet`
            }
            body={
              q
                ? 'Try a place, a month, or a word from a note.'
                : filter === 'all'
                  ? 'Add your first date, the day it became official, or a trip you loved.'
                  : 'Tap + to add one, or pick another filter.'
            }
          />
        </View>
      ) : (
        <View style={styles.timeline}>
          <View style={[styles.rail, { backgroundColor: separatorColor(colors) }]} />
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

/** Day counts worth celebrating, like the couple counter apps: 100 days, 1 year, 1,000 days… */
const DAY_MILESTONES = [100, 200, 300, 365, 500, 730, 1000, 1095, 1461, 1500, 1826, 2000, 2500, 2922, 3000, 3653, 4000, 5000, 7305, 10000];

function milestoneLabel(n: number) {
  const years = Math.round(n / 365.25);
  return Math.abs(n - years * 365.25) < 1.5 && years > 0
    ? `${years} year${years === 1 ? '' : 's'}`
    : `${n.toLocaleString()} days`;
}

/** Everything the Together since card shows: the count, its breakdown and the next milestone. */
function togetherFacts(since: Date) {
  const now = new Date();
  const days = Math.max(0, differenceInCalendarDays(now, since));
  const d = intervalToDuration({ start: since, end: now });
  const next = DAY_MILESTONES.find((m) => m > days) ?? Math.ceil((days + 1) / 1000) * 1000;
  const prev = [...DAY_MILESTONES].reverse().find((m) => m <= days) ?? 0;
  return {
    days,
    parts: [
      { n: d.years ?? 0, unit: (d.years ?? 0) === 1 ? 'year' : 'years' },
      { n: d.months ?? 0, unit: (d.months ?? 0) === 1 ? 'month' : 'months' },
      { n: d.days ?? 0, unit: (d.days ?? 0) === 1 ? 'day' : 'days' },
    ],
    milestone: {
      label: milestoneLabel(next),
      inDays: next - days,
      date: addDays(startOfDay(since), next),
      progress: Math.min(1, Math.max(0, (days - prev) / (next - prev))),
    },
  };
}

/**
 * The first memory on the timeline, after the couple day-counter apps: the two of you joined by a
 * heart, the big number of days, years / months / days, and how close the next milestone is.
 */
function TogetherSinceCard({ date }: { date: Date }) {
  const { colors } = useTheme();
  const me = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const facts = togetherFacts(date);
  const tone = memoryTone('milestone', colors);
  const names = [getFirstName(me?.name) ?? 'You', getFirstName(partner?.name) ?? 'Partner'].join(' & ');
  return (
    <View style={[styles.card, styles.togetherCard, { backgroundColor: tone.fill }, cardEdge(colors)]}>
      <View style={styles.togetherWatermark} pointerEvents="none">
        <Icon name="heart" size={170} color={colorWithAlpha(tone.ink, 0.1)} filled />
      </View>

      <View style={styles.togetherHead}>
        <Text style={[styles.togetherKicker, { color: tone.ink }]}>Together since</Text>
        <View style={[styles.badge, { backgroundColor: colors.surface }, paperEdge(colors, 1.5)]}>
          <Text style={[styles.badgeText, { color: colors.text }]} numberOfLines={1}>
            {format(date, 'd MMM yyyy')}
          </Text>
        </View>
      </View>

      {/* You two, joined by a heart. */}
      <View style={styles.couple}>
        <View style={[styles.coupleFace, { borderColor: colors.surface }]}>
          <Avatar name={me?.name} imageUrl={me?.avatar_url} size={52} />
        </View>
        <View style={[styles.coupleLine, { backgroundColor: colorWithAlpha(tone.ink, 0.35) }]} />
        <View style={[styles.coupleHeart, { backgroundColor: tone.ink }]}>
          <Icon name="heart" size={14} color={tone.fill} filled />
        </View>
        <View style={[styles.coupleLine, { backgroundColor: colorWithAlpha(tone.ink, 0.35) }]} />
        <View style={[styles.coupleFace, { borderColor: colors.surface }]}>
          <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={52} />
        </View>
      </View>
      <Text style={[styles.coupleNames, { color: colors.textSecondary }]} numberOfLines={1}>
        {names}
      </Text>

      <View style={styles.countBlock}>
        <Text style={[styles.countNum, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {facts.days.toLocaleString()}
        </Text>
        <Text style={[styles.countUnit, { color: colors.text }]}>{facts.days === 1 ? 'day together' : 'days together'}</Text>
      </View>

      <View style={styles.partsRow}>
        {facts.parts.map((part) => (
          <View key={part.unit} style={[styles.partTile, { backgroundColor: colors.surface }, cardEdge(colors)]}>
            <Text style={[styles.partNum, { color: colors.text }]}>{part.n}</Text>
            <Text style={[styles.partUnit, { color: colors.textSecondary }]}>{part.unit}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.togetherStats, { backgroundColor: colors.surface }, cardEdge(colors)]}>
        <View style={styles.milestoneHead}>
          <View style={[styles.statIcon, { backgroundColor: tone.fill }]}>
            <Icon name="flag" size={14} color={tone.ink} filled />
          </View>
          <View style={styles.togetherStatText}>
            <Text style={[styles.togetherStatValue, { color: colors.text }]} numberOfLines={1}>
              Next: {facts.milestone.label}
            </Text>
            <Text style={[styles.togetherStatSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {format(facts.milestone.date, 'EEE d MMM yyyy')}
            </Text>
          </View>
          {/* How many days are left, as its own little block: the number big, the words under it. */}
          <View style={[styles.daysLeft, { backgroundColor: tone.fill }]}>
            <Text style={[styles.daysLeftNum, { color: colors.text }]}>{facts.milestone.inDays.toLocaleString()}</Text>
            <Text style={[styles.daysLeftUnit, { color: colors.textSecondary }]}>
              {facts.milestone.inDays === 1 ? 'day left' : 'days left'}
            </Text>
          </View>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: trackColor(colors) }]}>
          <View style={[styles.progressFill, { backgroundColor: tone.ink, width: `${Math.round(facts.milestone.progress * 100)}%` }]} />
        </View>
      </View>
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
      <View style={[styles.row, styles.streakRow]}>
        <View style={[styles.smallDot, { backgroundColor: colors.textTertiary }]} />
        <View style={[styles.streakPill, cardSurface(colors)]}>
          <StreakFlame size={16} tone="active" />
          <Text style={[styles.smallText, { color: colors.text }]}>
            {item.days}-day streak <Text style={{ color: colors.textSecondary }}>· {format(item.date, 'MMM d')}</Text>
          </Text>
        </View>
      </View>
    );
  }

  if (item.kind === 'together') {
    const tone = memoryTone('milestone', colors);
    return (
      <View style={styles.row}>
        <View style={[styles.bigDot, { backgroundColor: tone.ink, borderColor: tone.fill }]} />
        <TogetherSinceCard date={item.date} />
      </View>
    );
  }

  if (item.kind === 'suggestion') {
    const s = item.suggestion;
    const thumbs = s.moments.filter((m) => m.media_url && m.type === 'photo').slice(0, 3);
    const extra = s.moments.length - thumbs.length;
    return (
      <View style={styles.row}>
        <View style={[styles.dot, styles.dotDashed, { borderColor: colors.textSecondary, backgroundColor: colors.background }]} />
        <View style={[styles.card, styles.suggestion, { backgroundColor: cardSurface(colors).backgroundColor, borderColor: colors.textSecondary }]}>
          <View style={styles.cardHead}>
            <View style={styles.titleRow}>
              <View style={[styles.statIcon, { backgroundColor: colors.surfaceElevated }]}>
                <Icon name="camera" size={15} color={colors.text} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{s.moments.length} moments that day</Text>
            </View>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{format(s.date, 'MMM d')}</Text>
          </View>
          <View style={styles.thumbs}>
            {thumbs.map((m) => (
              <Image key={m.id} source={mediaSource(thumbUrl(m.media_url!))} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
            ))}
            {extra > 0 ? (
              <View style={[styles.thumb, styles.more, { backgroundColor: colors.surfaceElevated, borderColor: outlineColor(colors) }]}>
                <Text style={[styles.moreText, { color: colors.text }]}>+{extra}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.actions}>
            <Pressable
              onPress={() => onAccept(s)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.pill, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
              <Text style={[styles.pillText, { color: colors.onAccent }]}>Add as memory</Text>
            </Pressable>
            <Pressable
              onPress={() => onDismiss(s)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.pill, styles.pillOutline, { borderColor: colors.text }, pressed && styles.pressed]}>
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
  const tone = memoryTone(meta.memoryType, colors);

  /** The memory's kind as a small pill: its icon in its colour, the name in text colour. */
  const typeBadge = (
    <View style={[styles.badge, { backgroundColor: colors.surface }, paperEdge(colors, 1.5)]}>
      <Icon name={type.icon} size={12} color={tone.ink} />
      <Text style={[styles.badgeText, { color: colors.text }]} numberOfLines={1}>
        {isMilestone ? 'Milestone' : type.label}
      </Text>
    </View>
  );

  return (
    <Pressable
      onPress={() => onOpen(item.entry)}
      accessibilityRole="button"
      accessibilityLabel={`${item.entry.title}, ${type.label}, ${format(item.date, 'd MMMM yyyy')}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View
        style={[
          isMilestone ? styles.bigDot : styles.dot,
          { backgroundColor: tone.ink, borderColor: isMilestone ? tone.fill : 'transparent' },
        ]}
      />
      {cover ? (
        // With photos: the cover big on top (count and kind over it), the words on the memory's colour.
        <View style={[styles.card, styles.photoCard, { backgroundColor: tone.fill }]}>
          <View>
            <Image source={mediaSource(cover)} style={isMilestone ? styles.photoCoverTall : styles.photoCover} contentFit="cover" />
            <View style={styles.photoBadges}>
              {typeBadge}
              {item.photos.length > 1 ? (
                <View style={[styles.badge, styles.countBadge]}>
                  <Icon name="image" size={12} color="#FFFFFF" />
                  <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>{item.photos.length}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.photoBody}>
            <Text style={[styles.photoTitle, { color: colors.text }]} numberOfLines={2}>
              {item.entry.title}
            </Text>
            <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
              {format(item.date, 'd MMMM yyyy')}
            </Text>
            {meta.placeName ? (
              <View style={styles.metaLine}>
                <Icon name="location" size={13} color={tone.ink} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {meta.placeName}
                </Text>
              </View>
            ) : null}
            {meta.notes ? (
              <View style={styles.storyQuote}>
                <View style={[styles.storyQuoteBar, { backgroundColor: tone.ink }]} />
                <Text style={[styles.quote, { color: colors.text }]} numberOfLines={2}>
                  {meta.notes}
                </Text>
              </View>
            ) : null}
          </View>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.photoCardEdge, cardEdge(colors)]} />
        </View>
      ) : (
        // No photo: a story card as substantial as a photo memory (after Apple Journal / Day One): the
        // memory's colour, a big date, the title, the note as a pull-quote, the tags at the foot, and
        // the kind's icon large in the corner so even a title-only memory has presence.
        <View style={[styles.card, styles.story, isMilestone && styles.storyMilestone, { backgroundColor: tone.fill }, cardEdge(colors)]}>
          <View style={styles.storyWatermark} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon name={type.icon} size={isMilestone ? 128 : 104} color={colorWithAlpha(tone.ink, 0.16)} filled />
          </View>

          <View style={styles.storyTop}>
            <View style={styles.storyDate}>
              <Text style={[styles.storyDay, { color: colors.text }]}>{format(item.date, 'd')}</Text>
              <Text style={[styles.storyMonth, { color: colors.text }]}>{format(item.date, 'MMMM yyyy')}</Text>
            </View>
          </View>

          <Text style={[styles.storyTitle, { color: colors.text }]} numberOfLines={3}>
            {item.entry.title}
          </Text>

          {meta.notes ? (
            <View style={styles.storyQuote}>
              <View style={[styles.storyQuoteBar, { backgroundColor: tone.ink }]} />
              <Text style={[styles.storyNote, { color: colors.text }]} numberOfLines={4}>
                {meta.notes}
              </Text>
            </View>
          ) : null}

          <View style={styles.storyTags}>
            {typeBadge}
            {meta.placeName ? (
              <View style={[styles.badge, styles.badgeShrink, { backgroundColor: colors.surface }, paperEdge(colors, 1.5)]}>
                <Icon name="location" size={12} color={tone.ink} />
                <Text style={[styles.badgeText, styles.flexShrink, { color: colors.textSecondary }]} numberOfLines={1}>
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
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12 },
  pressed: { opacity: 0.75 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 14 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  // flexGrow 0: a horizontal ScrollView otherwise stretches to fill the tab's height.
  chipsScroll: { flexGrow: 0, marginHorizontal: -16 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 14, fontWeight: '700' },
  timeline: { paddingLeft: 34, paddingTop: 6, gap: 16 },
  rail: { position: 'absolute', left: RAIL_X, top: 10, bottom: 0, width: 2, borderRadius: 1 },
  year: { marginLeft: -34, marginBottom: 12, paddingVertical: 4, fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { position: 'absolute', left: -29, top: 16, width: 12, height: 12, borderRadius: 6 },
  dotDashed: { borderWidth: 2, borderStyle: 'dashed' },
  bigDot: { position: 'absolute', left: -32, top: 13, width: 18, height: 18, borderRadius: 9, borderWidth: 4 },
  smallDot: { position: 'absolute', left: -27, top: 14, width: 8, height: 8, borderRadius: 4 },
  streakRow: { alignItems: 'center' },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18 },
  smallText: { fontSize: 14, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1 },
  flexShrink: { flexShrink: 1 },
  card: { flex: 1, borderRadius: 22 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardSub: { fontSize: 13, fontWeight: '600' },
  suggestion: { borderWidth: 1.5, borderStyle: 'dashed', padding: 14, gap: 12 },
  thumbs: { flexDirection: 'row', gap: 6 },
  thumb: { width: 56, height: 56, borderRadius: 14 },
  more: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  moreText: { fontSize: 15, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8 },
  pill: { height: 38, paddingHorizontal: 18, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  pillText: { fontSize: 13, fontWeight: '800' },
  pillOutline: { backgroundColor: 'transparent', borderWidth: 1.5 },
  // Small pills over photos and at a story card's foot.
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
  },
  badgeShrink: { flexShrink: 1, maxWidth: '100%' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  countBadge: { backgroundColor: 'rgba(0,0,0,0.55)' },
  photoCard: { overflow: 'hidden' },
  photoCardEdge: { borderRadius: 22 },
  photoCover: { height: 168, width: '100%' },
  photoCoverTall: { height: 210, width: '100%' },
  photoBadges: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  photoBody: { padding: 14, gap: 6 },
  photoTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.4, lineHeight: 24 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flex: 1, fontSize: 13, fontWeight: '600' },
  // A note reads like a quote, in a serif.
  quote: { flex: 1, fontSize: 14, lineHeight: 20, fontStyle: 'italic', fontFamily: SERIF },
  story: { minHeight: 176, padding: 16, gap: 10, overflow: 'hidden' },
  storyMilestone: { minHeight: 200 },
  storyWatermark: {
    position: 'absolute',
    right: -6,
    bottom: -14,
    transform: [{ rotate: '-12deg' }],
  },
  togetherCard: { padding: 16, gap: 14, overflow: 'hidden' },
  togetherWatermark: { position: 'absolute', right: -24, bottom: -34, transform: [{ rotate: '-12deg' }] },
  togetherHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  togetherKicker: { fontSize: 13, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  couple: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  coupleFace: { borderWidth: 3, borderRadius: 30 },
  coupleLine: { width: 18, height: 2, borderRadius: 1 },
  coupleHeart: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  coupleNames: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: -6 },
  countBlock: { alignItems: 'center' },
  countNum: { fontSize: 56, fontWeight: '900', letterSpacing: -2, lineHeight: 62, fontVariant: ['tabular-nums'] },
  countUnit: { fontSize: 15, fontWeight: '800', marginTop: -2 },
  partsRow: { flexDirection: 'row', gap: 8 },
  partTile: { flex: 1, borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  partNum: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  partUnit: { fontSize: 12, fontWeight: '700' },
  milestoneHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 11, paddingBottom: 10 },
  daysLeft: { minWidth: 64, alignItems: 'center', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  daysLeftNum: { fontSize: 18, fontWeight: '900', lineHeight: 22, fontVariant: ['tabular-nums'] },
  daysLeftUnit: { fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: 6, borderRadius: 3 },
  togetherStats: { borderRadius: 16, paddingHorizontal: 12 },
  togetherStat: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  togetherStatDivided: { borderTopWidth: 1 },
  statIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  togetherStatText: { flex: 1, minWidth: 0, gap: 1 },
  togetherStatValue: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  togetherStatSub: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  storyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  storyDate: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  storyDay: { fontSize: 40, fontWeight: '900', letterSpacing: -1.5, lineHeight: 44 },
  storyMonth: { fontSize: 16, fontWeight: '800' },
  storyTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, lineHeight: 27 },
  storyQuote: { flexDirection: 'row', gap: 10 },
  storyQuoteBar: { width: 3, borderRadius: 2 },
  storyNote: { flex: 1, fontSize: 16, lineHeight: 23, fontStyle: 'italic', fontFamily: SERIF },
  // Pinned to the foot of the card, so short memories keep their tags at the bottom.
  storyTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 'auto', paddingTop: 4 },
  // Fills the space under the filters, and sits in the middle of it.
  empty: { flex: 1, justifyContent: 'center', minHeight: 320 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 280 },
});
