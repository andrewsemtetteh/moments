import { addDays, addMonths, format, isToday, startOfDay, startOfMonth } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CreatePlanFlow, type CreatePlanPayload } from '@/components/calendar/plan/CreatePlanFlow';
import { EventDetailsSheet } from '@/components/calendar/plan/EventDetailsSheet';
import { buildDayEvents, PlanAgendaList } from '@/components/calendar/plan/PlanAgendaList';
import { PlanListSheet } from '@/components/calendar/plan/PlanListSheet';
import { PlanMonthGrid, PlanWeekStrip } from '@/components/calendar/plan/PlanWeekStrip';
import { PlanToolbar } from '@/components/calendar/plan/PlanToolbar';
import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { Icon } from '@/components/ui/Icon';
import { useCalendarEvents, useRealtimeSubscription, useUpcomingCalendarEvents } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import {
  createListFromPlan,
  fetchPlanLists,
  savePlanLists,
  syncChecklistIntoList,
  type PlanList,
} from '@/lib/plan-local';
import { parsePlanMeta, serializePlanMeta, type PlanKindKey } from '@/lib/plan-meta';
import * as api from '@/services/api';
import { useRelationshipStore } from '@/stores';
import type { CalendarEvent } from '@/types/database';

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
        setMode('week');
        const today = startOfDay(new Date());
        setSelectedDate(today);
        setCurrentMonth(startOfMonth(today));
        setCreateOpen(false);
        setDetailEvent(null);
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

  const { data: monthEvents, refetch: refetchMonth } = useCalendarEvents(currentMonth);
  const { data: upcoming, refetch: refetchUpcoming } = useUpcomingCalendarEvents();
  useRealtimeSubscription('calendar_events');

  const allEvents = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    for (const e of [...(monthEvents ?? []), ...(upcoming ?? [])]) map.set(e.id, e);
    return Array.from(map.values());
  }, [monthEvents, upcoming]);

  const dayEvents = useMemo(
    () => buildDayEvents(selectedDate, upcoming ?? [], monthEvents ?? []),
    [selectedDate, upcoming, monthEvents],
  );

  const activeList = useMemo(
    () => lists.find((l) => l.id === activeListId) ?? null,
    [lists, activeListId],
  );

  const invalidate = useCallback(async () => {
    await Promise.all([
      refetchMonth(),
      refetchUpcoming(),
      queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      queryClient.invalidateQueries({ queryKey: ['calendarUpcoming'] }),
    ]);
  }, [queryClient, refetchMonth, refetchUpcoming]);

  const persistLists = async (next: PlanList[]) => {
    setLists(next);
    if (relationship) await savePlanLists(relationship.id, next);
  };

  const selectDay = (day: Date) => {
    Haptics.selectionAsync();
    setSelectedDate(startOfDay(day));
    setCurrentMonth(startOfMonth(day));
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
    if (!relationship) return;
    setSaving(true);
    try {
      let description = payload.description;
      const created = await api.createCalendarEvent(relationship.id, {
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
        await api.updateCalendarEvent(created.id, { description });
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

      setCreateOpen(false);
      selectDay(payload.dateTime);
      await invalidate();
    } catch {
      Alert.alert('Could not save', 'Please try again.');
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

      const meta = parsePlanMeta(patch.description);
      const linked = lists.find(
        (l) => l.id === meta.linkedListId || l.eventId === detailEvent.id,
      );
      if (linked && meta.checklist) {
        await persistLists(
          lists.map((l) => (l.id === linked.id ? syncChecklistIntoList(l, meta.checklist!) : l)),
        );
      }

      await invalidate();
    } catch {
      Alert.alert('Could not update', 'Please try again.');
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
    } catch {
      Alert.alert('Could not delete', 'Please try again.');
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
          onPrevMonth={() => setCurrentMonth((m) => addMonths(m, -1))}
          onNextMonth={() => setCurrentMonth((m) => addMonths(m, 1))}
        />

        <View style={styles.calendarPad}>
          {mode === 'week' ? (
            <PlanWeekStrip
              selectedDate={selectedDate}
              events={allEvents}
              onSelectDate={(d) => selectDay(d)}
            />
          ) : (
            <PlanMonthGrid
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              events={allEvents}
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

          <PlanAgendaList
            events={dayEvents}
            selectedDate={selectedDate}
            hideGroupLabel
            onPressEvent={(event) => setDetailEvent(event)}
            emptyAction={() => openCreate(undefined, false)}
          />
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
            ? allEvents.find((e) => e.id === activeList.eventId)?.title ?? null
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
  calendarPad: { paddingHorizontal: 12 },
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
});
