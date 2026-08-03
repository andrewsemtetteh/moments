import {
  addDays,
  addMonths,
  format,
  getDate,
  getDaysInMonth,
  isSameDay,
  isToday,
  setDate,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CreatePlanFlow, type CreatePlanPayload } from '@/components/calendar/plan/CreatePlanFlow';
import { EventDetailsSheet } from '@/components/calendar/plan/EventDetailsSheet';
import { PlanAgendaList } from '@/components/calendar/plan/PlanAgendaList';
import { PlanListSheet } from '@/components/calendar/plan/PlanListSheet';
import { PlanMonthGrid, PlanWeekStrip } from '@/components/calendar/plan/PlanWeekStrip';
import { PlanToolbar } from '@/components/calendar/plan/PlanToolbar';
import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { Icon } from '@/components/ui/Icon';
import { usePlanCalendarEvents, useRealtimeSubscription } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import {
  createListFromPlan,
  fetchPlanLists,
  savePlanLists,
  syncChecklistIntoList,
  type PlanList,
} from '@/lib/plan-local';
import { parsePlanMeta, serializePlanMeta, type PlanKindKey } from '@/lib/plan-meta';
import { getErrorMessage } from '@/lib/network-error';
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

export default function CalendarScreen() {
  const { create } = useLocalSearchParams<{ create?: string }>();
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

  const shiftDay = (delta: number) => {
    Haptics.selectionAsync();
    const next = startOfDay(addDays(selectedDate, delta));
    setSelectedDate(next);
    setCurrentMonth(startOfMonth(next));
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

  const dateLabel = isToday(selectedDate)
    ? `Today · ${format(selectedDate, 'EEE, MMM d')}`
    : format(selectedDate, 'EEEE, MMM d');

  return (
    <ScreenContainer padded={false} tabSwipe>
      <AppHeader />

      <TabScreenScroll showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <PlanToolbar
          month={currentMonth}
          mode={mode}
          onToggleMode={() => setMode((m) => (m === 'week' ? 'month' : 'week'))}
          onAdd={() => openCreate(undefined, false)}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
        />

        <View style={styles.calendarPad}>
          {mode === 'week' ? (
            <PlanWeekStrip
              selectedDate={selectedDate}
              events={planEvents}
              onSelectDate={(d) => selectDay(d)}
            />
          ) : (
            <PlanMonthGrid
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              events={planEvents}
              onSelectDate={(d) => selectDay(d)}
            />
          )}
        </View>

        <View style={styles.agendaPad}>
          <View style={styles.dateNav}>
            <Pressable
              onPress={() => shiftDay(-1)}
              hitSlop={8}
              style={[styles.navBtn, { backgroundColor: colors.surface }]}
              accessibilityLabel="Previous day">
              <Icon name="chevronLeft" size={20} color={colors.text} />
            </Pressable>
            <Text style={[styles.dateNavLabel, { color: colors.text }]} numberOfLines={1}>
              {dateLabel}
            </Text>
            <Pressable
              onPress={() => shiftDay(1)}
              hitSlop={8}
              style={[styles.navBtn, { backgroundColor: colors.surface }]}
              accessibilityLabel="Next day">
              <Icon name="chevronRight" size={20} color={colors.text} />
            </Pressable>
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
        </View>
      </TabScreenScroll>

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
          router.push('/(tabs)/chat');
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 120, gap: 20 },
  calendarPad: { paddingHorizontal: 20 },
  agendaPad: { paddingHorizontal: 20, paddingTop: 4, gap: 14 },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
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
});
