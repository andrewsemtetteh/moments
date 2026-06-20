import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    format,
    isFuture,
    isSameDay,
    isSameMonth,
    startOfMonth,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AddEventSheet } from '@/components/calendar/AddEventSheet';
import { PlanCountdownHero } from '@/components/calendar/PlanCountdownHero';
import { PlanDayTimeline } from '@/components/calendar/PlanDayTimeline';
import { PlanMonthInsights } from '@/components/calendar/PlanMonthInsights';
import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { Icon } from '@/components/ui/Icon';
import { Card, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { EVENT_TYPE_META, EVENT_TYPES, getEventTypeColors } from '@/constants/calendar-events';
import { useCalendarEvents, useRealtimeSubscription, useUpcomingCalendarEvents } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import * as api from '@/services/api';
import { useRelationshipStore } from '@/stores';
import type { EventType } from '@/types/database';

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export default function CalendarScreen() {
  const { create } = useLocalSearchParams<{ create?: string }>();
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (create === '1' || create === 'true') {
      setShowCreate(true);
    }
  }, [create]);

  const { data: events, refetch } = useCalendarEvents(currentMonth);
  const { data: upcoming } = useUpcomingCalendarEvents();
  useRealtimeSubscription('calendar_events');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) =>
    (events ?? []).filter((e) => isSameDay(new Date(e.date_time), day));

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return getEventsForDay(selectedDate).sort(
      (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
    );
  }, [selectedDate, events]);

  const nextUpcoming = useMemo(() => {
    return (upcoming ?? [])
      .filter((e) => isFuture(new Date(e.date_time)))
      .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];
  }, [upcoming]);

  const plansAhead = useMemo(() => {
    return (upcoming ?? []).filter(
      (e) => isFuture(new Date(e.date_time)) && !isSameMonth(new Date(e.date_time), currentMonth),
    ).length;
  }, [upcoming, currentMonth]);

  const jumpToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCreate(true);
  };

  const createEvent = async (payload: { title: string; type: EventType; dateTime: Date }) => {
    if (!relationship) return;
    setSaving(true);
    try {
      await api.createCalendarEvent(relationship.id, {
        title: payload.title,
        date_time: payload.dateTime.toISOString(),
        type: payload.type,
        source: 'manual',
        description: null,
      });
      setShowCreate(false);
      setSelectedDate(payload.dateTime);
      setCurrentMonth(startOfMonth(payload.dateTime));
      refetch();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer padded={false}>
      <AppHeader />
      <TabScreenScroll showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {nextUpcoming ? <PlanCountdownHero event={nextUpcoming} /> : null}

        <Card style={[styles.calendarCard, { backgroundColor: colors.surface }]}>
          <View style={styles.monthHeader}>
            <Pressable
              onPress={() => setCurrentMonth(addMonths(currentMonth, -1))}
              style={[styles.navBtn, { backgroundColor: colors.surfaceElevated }]}>
              <Icon name="chevronLeft" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.monthCenter}>
              <Text style={[styles.monthTitle, { color: colors.text }]}>{format(currentMonth, 'MMMM yyyy')}</Text>
              <Pressable onPress={jumpToToday} style={[styles.todayChip, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800' }}>Today</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}
              style={[styles.navBtn, { backgroundColor: colors.surfaceElevated }]}>
              <Icon name="chevronRight" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.headerMeta}>
            <PlanMonthInsights events={events ?? []} currentMonth={currentMonth} plansAhead={plansAhead} />

            <View style={[styles.legend, { backgroundColor: colors.surfaceElevated }]}>
              {EVENT_TYPES.map((t) => {
                const tc = getEventTypeColors(t, colors);
                return (
                  <View key={t} style={[styles.legendPill, { backgroundColor: colors.surface }]}>
                    <View style={[styles.legendDot, { backgroundColor: tc.main }]} />
                    <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '700' }}>
                      {EVENT_TYPE_META[t].label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.weekDays}>
            {WEEK_DAYS.map((d, i) => (
              <Text key={i} style={[styles.weekDay, { color: colors.textTertiary }]}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isSelected = Boolean(selectedDate && isSameDay(day, selectedDate));
              const isToday = isSameDay(day, new Date());
              const hasEvents = dayEvents.length > 0;
              const primaryType = dayEvents[0]?.type;
              const eventColor = primaryType ? getEventTypeColors(primaryType, colors) : null;

              const fill = isSelected
                ? hasEvents && eventColor
                  ? eventColor.main
                  : colors.accent
                : hasEvents && eventColor
                  ? eventColor.soft
                  : undefined;

              const textColor = isSelected
                ? hasEvents && eventColor
                  ? eventColor.onMain
                  : colors.onAccent
                : isSameMonth(day, currentMonth)
                  ? colors.text
                  : colors.textTertiary;

              const showTodayRing = isToday && !isSelected;
              const ringColor = hasEvents && eventColor ? eventColor.main : colors.accent;

              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedDate(day);
                  }}
                  style={styles.dayCell}>
                  <View
                    style={[
                      styles.dayInner,
                      fill != null && { backgroundColor: fill },
                      showTodayRing && { borderColor: ringColor, borderWidth: 1.5 },
                    ]}>
                    <Text style={[styles.dayNum, { color: textColor }]}>{format(day, 'd')}</Text>
                  </View>
                  {hasEvents && (
                    <View style={styles.dotsRow}>
                      {dayEvents.slice(0, 3).map((e) => {
                        const dotColor = getEventTypeColors(e.type, colors);
                        return (
                          <View
                            key={e.id}
                            style={[
                              styles.dot,
                              {
                                backgroundColor: isSelected ? textColor : dotColor.main,
                              },
                            ]}
                          />
                        );
                      })}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Card>

        {selectedDate && (
          <View style={styles.eventsSection}>
            <SectionTitle action="Add event" onAction={openCreate}>
              {format(selectedDate, 'EEEE, MMM d')}
            </SectionTitle>

            {selectedEvents.length === 0 ? (
              <Pressable onPress={openCreate}>
                <Card style={[styles.emptyDay, { backgroundColor: colors.surface }]}>
                  <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
                    <Icon name="plus" size={22} color={colors.accent} />
                  </View>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Nothing planned yet</Text>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
                    Add a date night, reminder, or shared experience and we&apos;ll count it down together.
                  </Text>
                  <PrimaryButton label="Add event" onPress={openCreate} style={{ marginTop: 8, minWidth: 160 }} />
                </Card>
              </Pressable>
            ) : (
              <PlanDayTimeline events={selectedEvents} />
            )}
          </View>
        )}
      </TabScreenScroll>

      <Pressable
        onPress={openCreate}
        style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.shadow }]}>
        <Icon name="plus" size={26} color={colors.onAccent} />
      </Pressable>

      <AddEventSheet
        visible={showCreate}
        selectedDate={selectedDate}
        onClose={() => setShowCreate(false)}
        onSave={createEvent}
        saving={saving}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 16, paddingBottom: 100 },
  calendarCard: { paddingVertical: 4 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthCenter: { alignItems: 'center', gap: 6 },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 18, fontWeight: '800' },
  todayChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  headerMeta: { paddingBottom: 14, gap: 10 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 0,
    padding: 8,
    borderRadius: 16,
    justifyContent: 'center',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  weekDays: { flexDirection: 'row', marginBottom: 8, paddingHorizontal: 2 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 2 },
  dayCell: { width: `${100 / 7}%`, minHeight: 48, alignItems: 'center', paddingTop: 2 },
  dayInner: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: 15, fontWeight: '600' },
  dotsRow: { flexDirection: 'row', gap: 3, height: 8, marginTop: 2, justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  eventsSection: { marginTop: 4 },
  emptyDay: { alignItems: 'center', gap: 8, paddingVertical: 28, borderRadius: 20 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
});
