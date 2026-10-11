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
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreatePlanFlow, type CreatePlanPayload } from '@/components/calendar/plan/CreatePlanFlow';
import { EventDetailsSheet } from '@/components/calendar/plan/EventDetailsSheet';
import { PlanAgendaList } from '@/components/calendar/plan/PlanAgendaList';
import { PlanListSheet } from '@/components/calendar/plan/PlanListSheet';
import { PlanMonthGrid, PlanWeekStrip } from '@/components/calendar/plan/PlanWeekStrip';
import { PlanToolbar } from '@/components/calendar/plan/PlanToolbar';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { EVENT_TYPE_META, getEventTypeColors } from '@/constants/calendar-events';
import { Radius } from '@/constants/design-system';
import {
  usePlanCalendarEvents,
  useRealtimeSubscription,
  useUpcomingCalendarEvents,
} from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import {
  createListFromPlan,
  fetchPlanLists,
  savePlanLists,
  syncChecklistIntoList,
  type PlanList,
} from '@/lib/plan-local';
import {
  parsePlanMeta,
  planKindEmoji,
  serializePlanMeta,
  type PlanKindKey,
} from '@/lib/plan-meta';
import { getErrorMessage } from '@/lib/network-error';
import { closeStackScreen } from '@/lib/router';
import * as api from '@/services/api';
import { useRelationshipStore } from '@/stores';
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

export default function CalendarScreen() {
  const { create } = useLocalSearchParams<{ create?: string }>();
  const insets = useSafeAreaInsets();
  const closePlan = useCallback(() => closeStackScreen(router), []);
  const relationship = useRelationshipStore((s) => s.relationship);
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<PlanKindKey | undefined>();
  const [skipTypePicker, setSkipTypePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [lists, setLists] = useState<PlanList[]>([]);
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

  useEffect(() => {
    if (create === '1' || create === 'true') {
      setCreateKind(undefined);
      setSkipTypePicker(false);
      setCreateOpen(true);
    }
  }, [create]);

  useEffect(() => {
    if (!relationship) return;
    fetchPlanLists(relationship.id).then(setLists);
  }, [relationship]);

  const {
    data: planEvents = [],
    isError,
    error,
    refetch,
    isLoading,
  } = usePlanCalendarEvents(currentMonth);
  useRealtimeSubscription('calendar_events');

  const dayEvents = useMemo(
    () => eventsForDay(planEvents, selectedDate),
    [planEvents, selectedDate],
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
        .filter((e) => new Date(e.date_time).getTime() >= openedAt)
        .filter((e) => !isSameDay(new Date(e.date_time), selectedDate))
        .slice(0, COMING_UP_LIMIT),
    [upcomingEvents, selectedDate, openedAt],
  );

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

  const persistLists = async (next: PlanList[]) => {
    setLists(next);
    if (relationship) await savePlanLists(relationship.id, next);
  };

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

      let nextLists = [...lists];

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
        nextLists = [list, ...nextLists.filter((l) => l.id !== list.id)];
      }

      if (payload.attachedListIds.length) {
        nextLists = nextLists.map((l) =>
          payload.attachedListIds.includes(l.id) ? { ...l, eventId: created.id, archived: false } : l,
        );
      }

      if (payload.createSharedList || payload.attachedListIds.length) {
        await persistLists(nextLists);
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
    title: string;
    dateTime: Date;
    description: string;
  }) => {
    if (!detailEvent) return;
    setSaving(true);
    try {
      const updated = await api.updateCalendarEvent(detailEvent.id, {
        title: patch.title,
        date_time: patch.dateTime.toISOString(),
        description: patch.description,
      });
      setDetailEvent(updated);
      writeEventToCaches(updated);

      const meta = parsePlanMeta(patch.description);
      const linked = lists.find(
        (l) => l.id === meta.linkedListId || l.eventId === detailEvent.id,
      );
      if (linked && meta.checklist) {
        await persistLists(
          lists.map((l) => (l.id === linked.id ? syncChecklistIntoList(l, meta.checklist!) : l)),
        );
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
        await persistLists(
          lists.map((l) =>
            linkedIds.includes(l.id) ? { ...l, eventId: null, archived: true } : l,
          ),
        );
      }
      setDetailEvent(null);
      await invalidate();
    } catch (e) {
      Alert.alert('Could not delete', getErrorMessage(e) ?? 'Please try again.');
    }
  };

  const cardBorder = {
    borderColor: colors.border,
    borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Plan slides in from the left (its icon sits top-left on Home), so it
          closes toward the left: chevron on the right, or swipe left. */}
      <ScreenHeader title="Plan" onClose={closePlan} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}>
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
          ) : (
            <PlanAgendaList
              events={dayEvents}
              selectedDate={selectedDate}
              hideGroupLabel
              onPressEvent={(event) => setDetailEvent(event)}
              emptyAction={() => openCreate(undefined, false)}
            />
          )}
        </Animated.View>

        {comingUp.length > 0 ? (
          <Animated.View layout={LinearTransition.duration(260)} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>COMING UP</Text>
            <View style={[styles.upcomingCard, cardBorder, { backgroundColor: colors.surface }]}>
              {comingUp.map((event, i) => {
                const at = new Date(event.date_time);
                const tc = getEventTypeColors(event.type, colors);
                const emoji = planKindEmoji(event) ?? EVENT_TYPE_META[event.type]?.emoji ?? '📌';
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
                      <Text style={styles.upcomingEmoji}>{emoji}</Text>
                    </View>
                    <View style={styles.flexShrink}>
                      <Text style={[styles.upcomingTitle, { color: colors.text }]} numberOfLines={1}>
                        {event.title}
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
      </ScrollView>

      {/* Primary action as a floating button, thumb-reachable bottom-right —
          the same gradient treatment as the tab bar's create button. */}
      <Pressable
        onPress={() => openCreate(undefined, false)}
        accessibilityRole="button"
        accessibilityLabel="Add a plan"
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
            setActiveListId(list.id);
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
          void persistLists([list, ...lists.filter((l) => l.id !== list.id)]);
          void api
            .updateCalendarEvent(detailEvent.id, {
              description: serializePlanMeta({ ...meta, linkedListId: list.id, v: 1 }),
            })
            .then((updated) => {
              setDetailEvent(updated);
              writeEventToCaches(updated);
              void invalidate();
            });
          setDetailEvent(null);
          setActiveListId(list.id);
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
          void persistLists(lists.map((l) => (l.id === next.id ? next : l)));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flex: 1, minWidth: 0 },
  scroll: { paddingHorizontal: 16, gap: 24 },
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
  sectionLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6 },
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
