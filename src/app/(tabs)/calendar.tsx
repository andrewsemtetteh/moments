import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth, startOfMonth } from 'date-fns';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { Icon } from '@/components/ui/Icon';
import { Card, Chip, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { useCalendarEvents, useRealtimeSubscription } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import * as api from '@/services/api';
import { useRelationshipStore } from '@/stores';
import type { EventType } from '@/types/database';

const EVENT_META: Record<string, { emoji: string; label: string }> = {
  date: { emoji: '💕', label: 'Date' },
  anniversary: { emoji: '🎉', label: 'Anniversary' },
  reminder: { emoji: '⏰', label: 'Reminder' },
  experience: { emoji: '✨', label: 'Experience' },
  custom: { emoji: '📌', label: 'Custom' },
};

export default function CalendarScreen() {
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<EventType>('date');

  const { data: events, refetch } = useCalendarEvents(currentMonth);
  useRealtimeSubscription('calendar_events');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) => events?.filter((e) => isSameDay(new Date(e.date_time), day)) ?? [];
  const selectedEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  const createEvent = async () => {
    if (!relationship || !newTitle.trim() || !selectedDate) return;
    await api.createCalendarEvent(relationship.id, {
      title: newTitle.trim(),
      date_time: selectedDate.toISOString(),
      type: newType,
      source: 'manual',
      description: null,
    });
    setShowCreate(false);
    setNewTitle('');
    refetch();
  };

  return (
    <ScreenContainer padded={false}>
      <AppHeader />
      <TabScreenScroll showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Card>
          <View style={styles.monthHeader}>
            <Pressable onPress={() => setCurrentMonth(addMonths(currentMonth, -1))} style={[styles.navBtn, { backgroundColor: colors.surfaceElevated }]}>
              <Icon name="chevronLeft" size={20} color={colors.text} />
            </Pressable>
            <Text style={[styles.monthTitle, { color: colors.text }]}>{format(currentMonth, 'MMMM yyyy')}</Text>
            <Pressable onPress={() => setCurrentMonth(addMonths(currentMonth, 1))} style={[styles.navBtn, { backgroundColor: colors.surfaceElevated }]}>
              <Icon name="chevronRight" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.weekDays}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={i} style={[styles.weekDay, { color: colors.textTertiary }]}>{d}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              return (
                <Pressable key={day.toISOString()} onPress={() => setSelectedDate(day)} style={styles.dayCell}>
                  <View style={[
                    styles.dayInner,
                    isSelected && { backgroundColor: colors.accent },
                    !isSelected && isToday && { borderColor: colors.accent, borderWidth: 1.5 },
                  ]}>
                    <Text style={[styles.dayNum, { color: isSelected ? colors.onAccent : isSameMonth(day, currentMonth) ? colors.text : colors.textTertiary }]}>
                      {format(day, 'd')}
                    </Text>
                  </View>
                  <View style={styles.dotsRow}>
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <View key={i} style={[styles.dot, { backgroundColor: isSelected ? colors.accent : colors.accent }]} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {selectedDate && (
          <View style={styles.eventsSection}>
            <SectionTitle action="Add event" onAction={() => setShowCreate(true)}>
              {format(selectedDate, 'EEEE, MMM d')}
            </SectionTitle>
            {selectedEvents.length === 0 ? (
              <Pressable onPress={() => setShowCreate(true)}>
                <Card style={styles.emptyDay}>
                  <Icon name="plus" size={20} color={colors.accent} />
                  <Text style={{ color: colors.textSecondary }}>Your day is open. Tap + to plan something</Text>
                </Card>
              </Pressable>
            ) : (
              selectedEvents.map((e) => (
                <Card key={e.id} style={styles.eventCard}>
                  <Text style={styles.eventEmoji}>{EVENT_META[e.type]?.emoji ?? '📌'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventTitle, { color: colors.text }]}>{e.title}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {format(new Date(e.date_time), 'h:mm a')} · {EVENT_META[e.type]?.label ?? e.type}
                    </Text>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
      </TabScreenScroll>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.backgroundElevated }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Event</Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : ''}
            </Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="What are you planning?"
              placeholderTextColor={colors.textTertiary}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />
            <View style={styles.typeRow}>
              {(['date', 'anniversary', 'reminder', 'custom'] as EventType[]).map((t) => (
                <Chip key={t} label={EVENT_META[t].label} active={newType === t} onPress={() => setNewType(t)} />
              ))}
            </View>
            <PrimaryButton label="Save Event" onPress={createEvent} disabled={!newTitle.trim()} style={{ marginTop: 8 }} />
            <Pressable onPress={() => setShowCreate(false)} style={styles.cancelBtn}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  navBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 18, fontWeight: '800' },
  weekDays: { flexDirection: 'row', marginBottom: 6 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 15, fontWeight: '600' },
  dotsRow: { flexDirection: 'row', gap: 2, height: 6, marginTop: 1 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  eventsSection: { marginTop: 22 },
  emptyDay: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  eventEmoji: { fontSize: 26 },
  eventTitle: { fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(150,150,150,0.4)', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  modalInput: { borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 16, marginBottom: 14 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
});
