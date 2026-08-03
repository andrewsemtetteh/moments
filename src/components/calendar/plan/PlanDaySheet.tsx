import { format, isSameDay, startOfDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { EVENT_TYPE_META } from '@/constants/calendar-events';
import { useTheme } from '@/hooks/useTheme';
import { fetchDayNotes, saveDayNotes } from '@/lib/plan-local';
import { isPlanCompleted, parsePlanMeta, planKindEmoji } from '@/lib/plan-meta';
import type { CalendarEvent } from '@/types/database';

export function PlanDaySheet({
  visible,
  day,
  events,
  relationshipId,
  onClose,
  onPressEvent,
  onAddPlan,
}: {
  visible: boolean;
  day: Date;
  events: CalendarEvent[];
  relationshipId: string | null;
  onClose: () => void;
  onPressEvent: (event: CalendarEvent) => void;
  onAddPlan: () => void;
}) {
  const { colors } = useTheme();
  const dateKey = format(startOfDay(day), 'yyyy-MM-dd');
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);

  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => isSameDay(new Date(e.date_time), day))
        .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime()),
    [events, day],
  );

  useEffect(() => {
    if (!visible || !relationshipId) return;
    let cancelled = false;
    fetchDayNotes(relationshipId, dateKey).then((n) => {
      if (!cancelled) {
        setNotes(n);
        setNotesDirty(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, relationshipId, dateKey]);

  const persistNotes = async () => {
    if (!relationshipId || !notesDirty) return;
    await saveDayNotes(relationshipId, dateKey, notes.trim());
    setNotesDirty(false);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        void persistNotes();
        onClose();
      }}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            void persistNotes();
            onClose();
          }}
        />
        <View style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}>
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{format(day, 'EEEE, MMMM d')}</Text>
            <Pressable
              onPress={() => {
                void persistNotes();
                onClose();
              }}
              hitSlop={8}
              style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}>
              <Icon name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}>
            {dayEvents.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                No plans yet for this day.
              </Text>
            ) : (
              <View style={styles.list}>
                {dayEvents.map((event, index) => {
                  const meta = parsePlanMeta(event.description);
                  const done = isPlanCompleted(event);
                  const isLast = index === dayEvents.length - 1;
                  const showRail = dayEvents.length > 1;

                  return (
                    <View key={event.id} style={styles.row}>
                      {showRail ? (
                        <View style={styles.rail}>
                          <View
                            style={[
                              styles.node,
                              {
                                backgroundColor: done ? colors.accent : colors.surface,
                                borderColor: done ? colors.accent : colors.borderStrong,
                              },
                            ]}>
                            {done ? <Icon name="check" size={10} color={colors.onAccent} /> : null}
                          </View>
                          {!isLast ? (
                            <View
                              style={[
                                styles.railLine,
                                { backgroundColor: done ? colors.accent : colors.border },
                              ]}
                            />
                          ) : null}
                        </View>
                      ) : null}

                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          onPressEvent(event);
                        }}
                        style={({ pressed }) => [
                          styles.card,
                          {
                            backgroundColor: colors.surface,
                            opacity: pressed ? 0.92 : done ? 0.78 : 1,
                            flex: 1,
                          },
                        ]}>
                        <View style={styles.cardBody}>
                          <Text style={[styles.time, { color: colors.textSecondary }]}>
                            {format(new Date(event.date_time), 'h:mm a')}
                          </Text>
                          <Text
                            style={[
                              styles.cardTitle,
                              {
                                color: colors.text,
                                textDecorationLine: done ? 'line-through' : 'none',
                              },
                            ]}
                            numberOfLines={1}>
                            {event.title}
                          </Text>
                          {meta.location ? (
                            <Text style={[styles.location, { color: colors.textTertiary }]} numberOfLines={1}>
                              {meta.location}
                            </Text>
                          ) : null}
                        </View>
                        <View style={[styles.thumb, { backgroundColor: colors.accentSoft }]}>
                          <Text style={styles.emoji}>
                            {planKindEmoji(event) ?? EVENT_TYPE_META[event.type].emoji}
                          </Text>
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAddPlan();
              }}
              style={[styles.addBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.addLabel, { color: colors.accent }]}>+ Add another plan</Text>
            </Pressable>

            <View style={styles.notesHeader}>
              <Text style={[styles.notesTitle, { color: colors.text }]}>Notes for the day</Text>
            </View>
            <TextInput
              value={notes}
              onChangeText={(t) => {
                setNotes(t);
                setNotesDirty(true);
              }}
              onBlur={() => void persistNotes()}
              placeholder="Add a note for this day…"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[
                styles.notesInput,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, flex: 1, paddingRight: 12 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingBottom: 12, gap: 14 },
  empty: { fontSize: 15, fontWeight: '500', paddingVertical: 8 },
  list: { gap: 0 },
  row: { flexDirection: 'row', gap: 12, minHeight: 78 },
  rail: { width: 18, alignItems: 'center' },
  node: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    zIndex: 1,
  },
  railLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -4,
    borderRadius: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  cardBody: { flex: 1, gap: 3 },
  time: { fontSize: 13, fontWeight: '500' },
  cardTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  location: { fontSize: 13, fontWeight: '500' },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  addBtn: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addLabel: { fontSize: 15, fontWeight: '700' },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  notesTitle: { fontSize: 16, fontWeight: '700' },
  notesInput: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
});
