import {
  addMonths,
  differenceInCalendarDays,
  format,
  getDate,
  getDaysInMonth,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
  setDate,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { paperEdge } from '@/components/ui/primitives';
import * as Haptics from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { CreatePlanFlow, type CreatePlanPayload } from '@/components/calendar/plan/CreatePlanFlow';
import {
  MemoryDetailSheet,
  MemoryEditorSheet,
  memoryPhotos,
  type MemoryDraft,
} from '@/components/calendar/plan/MemorySheets';
import { PlanDayView, ownerColor } from '@/components/calendar/plan/PlanDayView';
import {
  PlanMemoriesTab,
  buildSuggestions,
  type MemorySuggestion,
} from '@/components/calendar/plan/PlanMemoriesTab';
import { EventDetailsSheet } from '@/components/calendar/plan/EventDetailsSheet';
import { PlanAgendaList } from '@/components/calendar/plan/PlanAgendaList';
import { PlanListSheet } from '@/components/calendar/plan/PlanListSheet';
import { PlanMonthGrid, PlanWeekStrip } from '@/components/calendar/plan/PlanWeekStrip';
import { PlanToolbar } from '@/components/calendar/plan/PlanToolbar';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { getEventTypeColors } from '@/constants/calendar-events';
import { Radius } from '@/constants/design-system';
import {
  useMemoryEntries,
  useMoments,
  usePlanCalendarEvents,
  useRealtimeSubscription,
  useStreak,
  useUpcomingCalendarEvents,
} from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import {
  createListFromPlan,
  normalizeList,
  planListsLegacyKey,
  syncChecklistIntoList,
  type PlanList,
} from '@/lib/plan-local';
import { getFirstName } from '@/lib/avatar-initial';
import { filterMediaMoments } from '@/lib/moment-display';
import { useCoupleDoc } from '@/lib/couple-doc';
import { groupMomentsIntoPlaces, useMomentPlaces } from '@/lib/moment-places';
import {
  displayTitle,
  freeTogetherWindow,
  matchesOwnerFilter,
  type OwnerFilter,
} from '@/lib/plan-day';
import {
  parsePlanMeta,
  serializePlanMeta,
  type PlanKindKey,
  type PlanMeta,
} from '@/lib/plan-meta';
import { getErrorMessage } from '@/lib/network-error';
import { closeStackScreen } from '@/lib/router';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { CalendarEvent } from '@/types/database';

function monthKey(day: Date) {
  return format(startOfMonth(day), 'yyyy-MM');
}

function upsertEvent(list: CalendarEvent[] | undefined, event: CalendarEvent): CalendarEvent[] {
  const next = [...(list ?? []).filter((e) => e.id !== event.id), event];
  return next.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
}

function eventsForDay(events: CalendarEvent[], day: Date) {
  return events
    .filter((e) => isSameDay(new Date(e.date_time), day))
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
}

function dayHeading(day: Date) {
  if (isToday(day)) return 'Today';
  if (isTomorrow(day)) return 'Tomorrow';
  if (isYesterday(day)) return 'Yesterday';
  return format(day, 'EEEE');
}

function countdownLabel(at: Date) {
  if (isToday(at)) return format(at, "'Today ·' h:mm a");
  if (isTomorrow(at)) return format(at, "'Tomorrow ·' h:mm a");
  // Calendar days, not elapsed 24h blocks — "in 2 days" should mean the day
  // after tomorrow regardless of what time of day it is now.
  const days = differenceInCalendarDays(at, new Date());
  return `In ${days} days · ${format(at, 'EEE, MMM d')}`;
}

const COMING_UP_LIMIT = 3;

const dismissedKey = (relationshipId: string) => `memory-suggestions-dismissed:${relationshipId}`;

/**
 * Each sheet here is its own native Modal, and on iPhone a Modal opened while
 * another is still sliding away never appears. Going from one sheet straight
 * to another waits for the first to finish closing.
 */
const SHEET_SWAP_MS = 380;
const afterSheetCloses = (fn: () => void) => setTimeout(fn, SHEET_SWAP_MS);
const NO_LISTS: PlanList[] = [];

export default function CalendarScreen() {
  const { create, tab: tabParam } = useLocalSearchParams<{ create?: string; tab?: string }>();
  const insets = useSafeAreaInsets();
  const closePlan = useCallback(() => closeStackScreen(router), []);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const partnerName = getFirstName(partner?.name) ?? 'Partner';

  // `?tab=memories` (e.g. Home's "years ago today" card) opens on Memories.
  const [tab, setTab] = useState<'upcoming' | 'memories'>(() => (tabParam === 'memories' ? 'memories' : 'upcoming'));
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');

  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<PlanKindKey | undefined>();
  const [skipTypePicker, setSkipTypePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  // Shared lists sync between both phones (the couple's "lists" document), so you each see
  // and tick the same list. They used to be kept only on the phone that made them.
  const { data: rawLists, write: writeLists } = useCoupleDoc<PlanList[]>('lists', NO_LISTS, planListsLegacyKey);
  const lists = useMemo(
    () =>
      (Array.isArray(rawLists) ? rawLists : NO_LISTS)
        .map(normalizeList)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [rawLists],
  );
  const [activeListId, setActiveListId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setCreateOpen(false);
        setDetailEvent(null);
        setActiveListId(null);
      };
    }, []),
  );

  // `?create=1` (e.g. "Plan something" elsewhere) opens New plan, once per link.
  const [seenCreate, setSeenCreate] = useState<string | undefined>(undefined);
  if (create !== seenCreate) {
    setSeenCreate(create);
    if (create === '1' || create === 'true') {
      setCreateKind(undefined);
      setSkipTypePicker(false);
      setCreateOpen(true);
    }
  }


  const {
    data: rawPlanEvents = [],
    isError,
    error,
    refetch,
    isLoading,
  } = usePlanCalendarEvents(currentMonth);
  useRealtimeSubscription('calendar_events');

  // "Whose plans" chips filter the dots, the day and Coming up alike.
  const planEvents = useMemo(
    () => rawPlanEvents.filter((e) => matchesOwnerFilter(e, ownerFilter, me?.id)),
    [rawPlanEvents, ownerFilter, me?.id],
  );

  // ── Memories (same synced table, see plan-meta `entry`) ──
  const { data: memories = [] } = useMemoryEntries();
  const { data: streak } = useStreak();
  const { data: momentPages } = useMoments();
  const allMoments = useMemo(() => filterMediaMoments(momentPages?.pages.flat() ?? []), [momentPages]);
  const momentsById = useMemo(() => new Map(allMoments.map((m) => [m.id, m])), [allMoments]);
  const { store: placesStore } = useMomentPlaces();
  const placeNames = useMemo(
    () =>
      groupMomentsIntoPlaces(allMoments, placesStore)
        .filter((p) => p.name)
        .map((p) => `${p.name!.emoji} ${p.name!.name}`),
    [allMoments, placesStore],
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [editorInitial, setEditorInitial] = useState<MemoryDraft | null>(null);
  const [editingMemory, setEditingMemory] = useState<CalendarEvent | null>(null);
  const [openMemory, setOpenMemory] = useState<CalendarEvent | null>(null);
  const [savingMemory, setSavingMemory] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!relationship?.id) return;
    void AsyncStorage.getItem(dismissedKey(relationship.id))
      .then((raw) => setDismissedSuggestions(new Set(raw ? (JSON.parse(raw) as string[]) : [])))
      .catch(() => undefined);
  }, [relationship?.id]);

  const suggestions = useMemo(
    () => buildSuggestions(allMoments, memories, dismissedSuggestions),
    [allMoments, memories, dismissedSuggestions],
  );

  const dayEvents = useMemo(
    () => eventsForDay(planEvents, selectedDate),
    [planEvents, selectedDate],
  );
  const allDayEvents = useMemo(
    () => eventsForDay(rawPlanEvents, selectedDate),
    [rawPlanEvents, selectedDate],
  );

  // Captured once per open — Plan is a stack screen that remounts every time
  // it's pushed, so this is always fresh without reading the clock mid-render.
  const [openedAt] = useState(() => Date.now());

  const { data: upcomingEvents = [] } = useUpcomingCalendarEvents();
  // What's next from right now, skipping whatever's already listed for the
  // selected day above — the section answers "and after that?".
  const comingUp = useMemo(
    () =>
      upcomingEvents
        .filter((e) => matchesOwnerFilter(e, ownerFilter, me?.id))
        .filter((e) => new Date(e.date_time).getTime() >= openedAt)
        .filter((e) => !isSameDay(new Date(e.date_time), selectedDate))
        .slice(0, COMING_UP_LIMIT),
    [upcomingEvents, selectedDate, openedAt, ownerFilter, me?.id],
  );

  // What an empty day says depends on the "whose plans" filter.
  const emptyCopy = (() => {
    const them = getFirstName(partner?.name) ?? 'your partner';
    switch (ownerFilter) {
      case 'together':
        return { title: 'Nothing together yet', body: 'Plans for the two of you on this day will show here.' };
      case 'me':
        return { title: 'Nothing just for you', body: 'Your own plans for this day will show here.' };
      case 'partner':
        return { title: `Nothing for ${them}`, body: `${them[0].toUpperCase()}${them.slice(1)}’s plans for this day will show here.` };
      default:
        return { title: 'Nothing planned', body: 'Plans for this day will show here.' };
    }
  })();

  const freeLabel = useMemo(() => {
    if (!partner) return null;
    if (startOfDay(selectedDate).getTime() < startOfDay(openedAt).getTime()) return null;
    return freeTogetherWindow(allDayEvents, selectedDate, new Date(openedAt))?.label ?? null;
  }, [partner, allDayEvents, selectedDate, openedAt]);

  const activeList = useMemo(
    () => lists.find((l) => l.id === activeListId) ?? null,
    [lists, activeListId],
  );

  const writeEventToCaches = useCallback(
    (event: CalendarEvent) => {
      if (!relationship) return;
      const key = monthKey(new Date(event.date_time));
      queryClient.setQueryData<CalendarEvent[]>(['calendarPlan', relationship.id, key], (old) =>
        upsertEvent(old, event),
      );
      // Also seed neighboring month caches if the hook key differs slightly after navigation.
      queryClient.setQueryData<CalendarEvent[]>(
        ['calendarPlan', relationship.id, monthKey(currentMonth)],
        (old) => upsertEvent(old, event),
      );
      queryClient.setQueryData<CalendarEvent[]>(['calendar', relationship.id, key], (old) =>
        upsertEvent(old, event),
      );
      queryClient.setQueryData<CalendarEvent[]>(['calendarUpcoming', relationship.id], (old) =>
        upsertEvent(old, event),
      );
    },
    [currentMonth, queryClient, relationship],
  );

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['calendarPlan'] }),
      queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      queryClient.invalidateQueries({ queryKey: ['calendarUpcoming'] }),
      refetch(),
    ]);
  }, [queryClient, refetch]);

  /** Applied to the latest copy, so your partner's edit made a moment ago isn't overwritten. */
  const updateLists = (change: (current: PlanList[]) => PlanList[]) =>
    writeLists((current) => change((Array.isArray(current) ? current : NO_LISTS).map(normalizeList)));

  const selectDay = (day: Date) => {
    Haptics.selectionAsync();
    setSelectedDate(startOfDay(day));
    setCurrentMonth(startOfMonth(day));
  };

  const shiftMonth = (delta: number) => {
    Haptics.selectionAsync();
    const nextMonth = addMonths(currentMonth, delta);
    const clamped = Math.min(getDate(selectedDate), getDaysInMonth(nextMonth));
    const day = startOfDay(setDate(nextMonth, clamped));
    setCurrentMonth(startOfMonth(nextMonth));
    setSelectedDate(day);
  };

  const openCreate = (kind?: PlanKindKey, skipType = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCreateKind(kind);
    setSkipTypePicker(skipType);
    setCreateOpen(true);
  };

  const createEvent = async (payload: CreatePlanPayload) => {
    if (!relationship) {
      Alert.alert('Connect first', 'Invite your partner or join a space to save plans.');
      return;
    }
    setSaving(true);
    try {
      let description = payload.description;
      let created = await api.createCalendarEvent(relationship.id, {
        title: payload.title,
        date_time: payload.dateTime.toISOString(),
        type: payload.type,
        source: 'manual',
        description,
      });

      let newList: PlanList | null = null;

      if (payload.createSharedList) {
        const list = createListFromPlan({
          planTitle: payload.title,
          kind: payload.kind,
          eventId: created.id,
          checklist: payload.checklist,
        });
        const meta = parsePlanMeta(payload.description);
        description = serializePlanMeta({ ...meta, linkedListId: list.id, v: 1 });
        created = await api.updateCalendarEvent(created.id, { description });
        newList = list;
      }

      if (newList || payload.attachedListIds.length) {
        const planId = created.id;
        const added = newList;
        updateLists((current) => {
          let next = added ? [added, ...current.filter((l) => l.id !== added.id)] : current;
          if (payload.attachedListIds.length) {
            next = next.map((l) => (payload.attachedListIds.includes(l.id) ? { ...l, eventId: planId, archived: false } : l));
          }
          return next;
        });
      }

      writeEventToCaches(created);
      setCreateOpen(false);
      selectDay(payload.dateTime);
      void invalidate();
    } catch (e) {
      Alert.alert('Could not save', getErrorMessage(e) ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateEvent = async (patch: {
    id: string;
    title: string;
    dateTime: Date;
    description: string;
  }) => {
    setSaving(true);
    try {
      const updated = await api.updateCalendarEvent(patch.id, {
        title: patch.title,
        date_time: patch.dateTime.toISOString(),
        description: patch.description,
      });
      // Refresh the sheet only if it's still showing this plan: a save that
      // lands after closing it must not open it again.
      setDetailEvent((cur) => (cur?.id === updated.id ? updated : cur));
      writeEventToCaches(updated);

      const meta = parsePlanMeta(patch.description);
      const linked = lists.find(
        (l) => l.id === meta.linkedListId || l.eventId === patch.id,
      );
      if (linked && meta.checklist) {
        const checklist = meta.checklist;
        updateLists((current) => current.map((l) => (l.id === linked.id ? syncChecklistIntoList(l, checklist) : l)));
      }

      void invalidate();
    } catch (e) {
      Alert.alert('Could not update', getErrorMessage(e) ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!detailEvent) return;
    try {
      const linkedIds = lists
        .filter(
          (l) =>
            l.eventId === detailEvent.id ||
            l.id === parsePlanMeta(detailEvent.description).linkedListId,
        )
        .map((l) => l.id);
      await api.deleteCalendarEvent(detailEvent.id);
      if (linkedIds.length) {
        updateLists((current) => current.map((l) => (linkedIds.includes(l.id) ? { ...l, eventId: null, archived: true } : l)));
      }
      setDetailEvent(null);
      await invalidate();
    } catch (e) {
      Alert.alert('Could not delete', getErrorMessage(e) ?? 'Please try again.');
    }
  };

  const momentPhotoUrlsFor = (ids: string[]) =>
    Object.fromEntries(
      ids.map((id) => [id, momentsById.get(id)?.media_url]).filter(([, u]) => !!u),
    ) as Record<string, string>;

  const createMemory = async (draft: MemoryDraft, extra: Partial<PlanMeta> = {}) => {
    if (!relationship || !me) return;
    const at = new Date(draft.date);
    at.setHours(12, 0, 0, 0);
    await api.createCalendarEvent(relationship.id, {
      title: draft.title,
      date_time: at.toISOString(),
      type: 'custom',
      source: 'manual',
      description: serializePlanMeta({
        v: 1,
        entry: 'memory',
        memoryType: draft.memoryType,
        momentIds: draft.momentIds,
        momentPhotoUrls: momentPhotoUrlsFor(draft.momentIds),
        photoUrls: draft.photoUrls,
        placeName: draft.placeName || undefined,
        notes: draft.note || undefined,
        createdBy: me.id,
        ...extra,
      }),
    });
    void invalidate();
  };

  const saveMemoryDraft = async (draft: MemoryDraft) => {
    setSavingMemory(true);
    try {
      if (editingMemory) {
        const at = new Date(draft.date);
        at.setHours(12, 0, 0, 0);
        const meta = parsePlanMeta(editingMemory.description);
        const updated = await api.updateCalendarEvent(editingMemory.id, {
          title: draft.title,
          date_time: at.toISOString(),
          description: serializePlanMeta({
            ...meta,
            v: 1,
            memoryType: draft.memoryType,
            momentIds: draft.momentIds,
            momentPhotoUrls: { ...meta.momentPhotoUrls, ...momentPhotoUrlsFor(draft.momentIds) },
            photoUrls: draft.photoUrls,
            placeName: draft.placeName || undefined,
            notes: draft.note || undefined,
          }),
        });
        // Back to the memory, once the editor has slid away.
        afterSheetCloses(() => setOpenMemory(updated));
        void invalidate();
      } else {
        await createMemory(draft);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditorOpen(false);
      setEditingMemory(null);
    } catch (e) {
      Alert.alert('Could not save memory', getErrorMessage(e) ?? 'Please try again.');
    } finally {
      setSavingMemory(false);
    }
  };

  const openNewMemory = (initial: MemoryDraft | null = null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingMemory(null);
    setEditorInitial(initial);
    setEditorKey((k) => k + 1);
    setEditorOpen(true);
  };

  const editMemory = (entry: CalendarEvent) => {
    // From the memory's sheet: let it close first, then open the editor.
    if (openMemory) {
      setOpenMemory(null);
      afterSheetCloses(() => editMemory(entry));
      return;
    }
    const meta = parsePlanMeta(entry.description);
    setEditingMemory(entry);
    setEditorInitial({
      title: entry.title,
      date: startOfDay(new Date(entry.date_time)),
      memoryType: meta.memoryType ?? 'justus',
      momentIds: meta.momentIds ?? [],
      photoUrls: meta.photoUrls ?? [],
      placeName: meta.placeName ?? '',
      note: meta.notes ?? '',
    });
    setEditorKey((k) => k + 1);
    setEditorOpen(true);
  };

  const deleteMemory = async (entry: CalendarEvent) => {
    try {
      await api.deleteCalendarEvent(entry.id);
      setOpenMemory(null);
      void invalidate();
    } catch (e) {
      Alert.alert('Could not delete', getErrorMessage(e) ?? 'Please try again.');
    }
  };

  const acceptSuggestion = (sug: MemorySuggestion) =>
    openNewMemory({
      title: '',
      date: sug.date,
      memoryType: 'justus',
      momentIds: sug.moments.filter((m) => m.type === 'photo').slice(0, 8).map((m) => m.id),
      photoUrls: [],
      placeName: '',
      note: '',
    });

  const dismissSuggestion = (sug: MemorySuggestion) => {
    if (!relationship) return;
    const next = new Set(dismissedSuggestions).add(sug.key);
    setDismissedSuggestions(next);
    void AsyncStorage.setItem(dismissedKey(relationship.id), JSON.stringify([...next])).catch(() => undefined);
  };


  const cardBorder = {
    borderColor: colors.border,
    borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Plan slides in from the left (its icon sits top-left on Home), so it
          closes toward the left: chevron on the right, or swipe left. */}
      <ScreenHeader title="Together" onClose={closePlan} />

      <View style={[styles.tabs, { backgroundColor: colors.surface }, paperEdge(colors)]}>
        {(['upcoming', 'memories'] as const).map((key) => {
          const on = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => {
                Haptics.selectionAsync();
                setTab(key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tabBtn, on && { backgroundColor: colors.text }]}>
              <Text style={[styles.tabText, { color: on ? colors.background : colors.textSecondary }]}>
                {key === 'upcoming' ? 'Plan' : 'Memories'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 120 },
          tab === 'memories' && styles.scrollFill,
        ]}>
        {tab === 'memories' ? (
          <PlanMemoriesTab
            memories={memories}
            momentsById={momentsById}
            suggestions={suggestions}
            anniversaryDate={relationship?.anniversary_date}
            currentStreak={streak?.current_streak ?? 0}
            onOpen={setOpenMemory}
            onAcceptSuggestion={acceptSuggestion}
            onDismissSuggestion={dismissSuggestion}
          />
        ) : (
        <>
        {partner ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.ownerChipsScroll}
            contentContainerStyle={styles.ownerChips}>
            {(
              [
                { key: 'all', label: 'All', dot: null },
                { key: 'together', label: 'Together', dot: ownerColor('together', me?.id, colors) },
                { key: 'me', label: 'Me', dot: ownerColor(me?.id ?? 'me', me?.id, colors) },
                { key: 'partner', label: partnerName, dot: ownerColor('partner', me?.id, colors) },
              ] as const
            ).map((c) => {
              const on = ownerFilter === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setOwnerFilter(c.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.ownerChip, { backgroundColor: on ? colors.text : colors.surface }]}>
                  {c.dot ? <View style={[styles.ownerDot, { backgroundColor: c.dot }]} /> : null}
                  <Text style={[styles.ownerChipText, { color: on ? colors.background : colors.text }]} numberOfLines={1}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* One card for the whole calendar; LinearTransition animates its height
            when the month label expands the week strip into the full month. */}
        <Animated.View
          layout={LinearTransition.duration(260)}
          style={[styles.calendarCard, cardBorder, { backgroundColor: colors.surface }]}>
          <PlanToolbar
            month={currentMonth}
            mode={mode}
            showToday={!isToday(selectedDate)}
            onToggleMode={() => setMode((m) => (m === 'week' ? 'month' : 'week'))}
            onToday={() => selectDay(new Date())}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
          />
          {mode === 'week' ? (
            <Animated.View key="week" entering={FadeIn.duration(200)}>
              <PlanWeekStrip
                selectedDate={selectedDate}
                events={planEvents}
                onSelectDate={(d) => selectDay(d)}
              />
            </Animated.View>
          ) : (
            <Animated.View key="month" entering={FadeIn.duration(200)}>
              <PlanMonthGrid
                currentMonth={currentMonth}
                selectedDate={selectedDate}
                events={planEvents}
                onSelectDate={(d) => selectDay(d)}
              />
            </Animated.View>
          )}
        </Animated.View>

        <Animated.View layout={LinearTransition.duration(260)} style={styles.section}>
          <View style={styles.dayHeader}>
            <View style={styles.flexShrink}>
              <Text style={[styles.dayTitle, { color: colors.text }]}>{dayHeading(selectedDate)}</Text>
              <Text style={[styles.daySub, { color: colors.textSecondary }]}>
                {format(selectedDate, 'MMMM d, yyyy')}
              </Text>
            </View>
            {dayEvents.length > 0 ? (
              <View style={[styles.countPill, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.countText, { color: colors.accent }]}>
                  {dayEvents.length} plan{dayEvents.length === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}
          </View>

          {isError ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Couldn&apos;t load plans</Text>
              <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                {error instanceof Error ? error.message : 'Check your connection and try again.'}
              </Text>
              <Pressable
                onPress={() => void refetch()}
                style={[styles.retryBtn, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.accent, fontWeight: '700' }}>Retry</Text>
              </Pressable>
            </View>
          ) : isLoading && planEvents.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>Loading plans…</Text>
            </View>
          ) : partner ? (
            <PlanDayView
              day={selectedDate}
              isTodaySelected={isToday(selectedDate)}
              events={dayEvents}
              me={me ?? null}
              partner={partner}
              freeLabel={freeLabel}
              onPressEvent={(event) => setDetailEvent(event)}
              onPlanFree={() => openCreate(undefined, false)}
              emptyTitle={emptyCopy.title}
              emptyBody={emptyCopy.body}
            />
          ) : (
            <PlanAgendaList
              events={dayEvents}
              selectedDate={selectedDate}
              hideGroupLabel
              onPressEvent={(event) => setDetailEvent(event)}
              emptyTitle={emptyCopy.title}
              emptyBody={emptyCopy.body}
            />
          )}
        </Animated.View>

        {comingUp.length > 0 ? (
          <Animated.View layout={LinearTransition.duration(260)} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Coming up</Text>
            <View style={[styles.upcomingCard, cardBorder, { backgroundColor: colors.surface }]}>
              {comingUp.map((event, i) => {
                const at = new Date(event.date_time);
                const tc = getEventTypeColors(event.type, colors);
                return (
                  <Pressable
                    key={event.id}
                    onPress={() => selectDay(at)}
                    style={({ pressed }) => [
                      styles.upcomingRow,
                      i > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      },
                      pressed && { opacity: 0.6 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${event.title}, ${countdownLabel(at)}`}>
                    <View style={[styles.upcomingBadge, { backgroundColor: tc.soft }]}>
                      <Text style={[styles.upcomingDay, { color: tc.main }]}>{format(at, 'd')}</Text>
                      <Text style={[styles.upcomingMonth, { color: tc.main }]}>{format(at, 'MMM')}</Text>
                    </View>
                    <View style={styles.flexShrink}>
                      <Text style={[styles.upcomingTitle, { color: colors.text }]} numberOfLines={1}>
                        {displayTitle(event, me?.id)}
                      </Text>
                      <Text style={[styles.upcomingWhen, { color: tc.main }]} numberOfLines={1}>
                        {countdownLabel(at)}
                      </Text>
                    </View>
                    <Icon name="chevronRight" size={16} color={colors.textTertiary} />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        ) : null}
        </>
        )}
      </ScrollView>

      {/* Primary action as a floating button, thumb-reachable bottom-right —
          the same gradient treatment as the tab bar's create button. */}
      <Pressable
        onPress={() => (tab === 'memories' ? openNewMemory() : openCreate(undefined, false))}
        accessibilityRole="button"
        accessibilityLabel={tab === 'memories' ? 'Add a memory' : 'Add a plan'}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 20 },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}>
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabFill}>
          <Icon name="plus" size={28} color={colors.onAccent} />
        </LinearGradient>
      </Pressable>

      <CreatePlanFlow
        visible={createOpen}
        selectedDate={selectedDate}
        initialKind={createKind}
        skipTypePicker={skipTypePicker}
        existingLists={lists
          .filter((l) => !l.archived)
          .map((l) => ({ id: l.id, title: l.title, emoji: l.emoji }))}
        onClose={() => setCreateOpen(false)}
        onSave={createEvent}
        saving={saving}
        meId={me?.id}
        partnerName={partner ? partnerName : undefined}
      />

      <MemoryEditorSheet
        key={editorKey}
        visible={editorOpen}
        initial={editorInitial}
        recentMoments={allMoments}
        placeNames={placeNames}
        saving={savingMemory}
        onUploadPhoto={(uri) =>
          api.uploadMomentMedia(`${relationship?.id}/${me?.id}/memory-${Date.now()}.jpg`, uri, 'image/jpeg')
        }
        onClose={() => {
          setEditorOpen(false);
          setEditingMemory(null);
        }}
        onSave={(draft) => void saveMemoryDraft(draft)}
        onDelete={
          editingMemory
            ? () => {
                const entry = editingMemory;
                setEditorOpen(false);
                setEditingMemory(null);
                void deleteMemory(entry);
              }
            : undefined
        }
      />

      <MemoryDetailSheet
        entry={openMemory}
        photos={openMemory ? memoryPhotos(openMemory, momentsById) : []}
        me={me ?? null}
        partner={partner}
        onClose={() => setOpenMemory(null)}
        onEdit={() => openMemory && editMemory(openMemory)}
        onDelete={() => openMemory && void deleteMemory(openMemory)}
      />

      <EventDetailsSheet
        visible={!!detailEvent}
        event={detailEvent}
        linkedListTitle={
          detailEvent
            ? lists.find(
                (l) =>
                  l.id === parsePlanMeta(detailEvent.description).linkedListId ||
                  l.eventId === detailEvent.id,
              )?.title ?? null
            : null
        }
        onClose={() => setDetailEvent(null)}
        onSave={updateEvent}
        onDelete={deleteEvent}
        onMessage={() => {
          setDetailEvent(null);
          router.push('/chat');
        }}
        onOpenLinkedList={() => {
          if (!detailEvent) return;
          const list = lists.find(
            (l) =>
              l.id === parsePlanMeta(detailEvent.description).linkedListId ||
              l.eventId === detailEvent.id,
          );
          if (list) {
            setDetailEvent(null);
            afterSheetCloses(() => setActiveListId(list.id));
          }
        }}
        onCreateLinkedList={() => {
          if (!detailEvent || !relationship) return;
          const meta = parsePlanMeta(detailEvent.description);
          const kind = meta.kind ?? 'custom';
          const list = createListFromPlan({
            planTitle: detailEvent.title,
            kind,
            eventId: detailEvent.id,
            checklist: meta.checklist,
          });
          updateLists((current) => [list, ...current.filter((l) => l.id !== list.id)]);
          void api
            .updateCalendarEvent(detailEvent.id, {
              description: serializePlanMeta({ ...meta, linkedListId: list.id, v: 1 }),
            })
            .then((updated) => {
              // The details sheet is closed by now (the list is showing): don't reopen it.
              writeEventToCaches(updated);
              void invalidate();
            })
            .catch(() => undefined);
          setDetailEvent(null);
          afterSheetCloses(() => setActiveListId(list.id));
        }}
        saving={saving}
      />

      <PlanListSheet
        list={activeList}
        visible={!!activeList}
        linkedPlanTitle={
          activeList?.eventId
            ? planEvents.find((e) => e.id === activeList.eventId)?.title ?? null
            : null
        }
        onClose={() => setActiveListId(null)}
        onChange={(next) => {
          updateLists((current) => current.map((l) => (l.id === next.id ? next : l)));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flex: 1, minWidth: 0 },
  scroll: { paddingHorizontal: 16, gap: 24 },
  scrollFill: { flexGrow: 1 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, padding: 4, borderRadius: 999 },
  tabBtn: { flex: 1, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 15, fontWeight: '800' },
  // Plan's "whose plans" filter, as in the design: one sideways row of pills
  // (7×12 padding, 14pt bold, 8pt color dot), full-bleed to the screen edges.
  ownerChipsScroll: { flexGrow: 0, marginHorizontal: -16, marginBottom: -10 },
  ownerChips: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  ownerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  ownerDot: { width: 8, height: 8, borderRadius: 4 },
  ownerChipText: { fontSize: 14, fontWeight: '700' },
  calendarCard: {
    borderRadius: Radius.xl,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  section: { gap: 12, paddingHorizontal: 4 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  dayTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  daySub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  countPill: { paddingHorizontal: 12, height: 28, borderRadius: 14, justifyContent: 'center' },
  countText: { fontSize: 13, fontWeight: '700' },
  sectionLabel: { fontSize: 14, fontWeight: '800' },
  upcomingCard: { borderRadius: Radius.lg, overflow: 'hidden' },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  upcomingBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingDay: { fontSize: 15, fontWeight: '900', lineHeight: 17 },
  upcomingMonth: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  upcomingEmoji: { fontSize: 18 },
  upcomingTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  upcomingWhen: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  empty: {
    paddingVertical: 28,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  fabFill: {
    flex: 1,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
