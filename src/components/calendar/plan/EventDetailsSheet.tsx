import { format, setHours, setMilliseconds, setMinutes, setSeconds, startOfDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PlanDateModal, PlanTimeModal } from '@/components/calendar/plan/PlanPickerModals';
import { Icon } from '@/components/ui/Icon';
import { Avatar, PrimaryButton } from '@/components/ui/primitives';
import { EVENT_TYPE_META } from '@/constants/calendar-events';
import { useTheme } from '@/hooks/useTheme';
import {
  parsePlanMeta,
  planCountdownParts,
  planKindEmoji,
  reminderLabel,
  serializePlanMeta,
  REMINDER_OPTIONS,
  type PlanChecklistItem,
  type PlanMeta,
} from '@/lib/plan-meta';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { CalendarEvent } from '@/types/database';

function applyTimeParts(base: Date, h12: number, m: number, period: 'AM' | 'PM'): Date {
  const h24 = period === 'PM' ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
  return setMilliseconds(setSeconds(setMinutes(setHours(base, h24), m), 0), 0);
}

export function EventDetailsSheet({
  visible,
  event,
  linkedListTitle,
  onClose,
  onSave,
  onDelete,
  onMessage,
  onOpenLinkedList,
  onCreateLinkedList,
  saving,
}: {
  visible: boolean;
  event: CalendarEvent | null;
  linkedListTitle?: string | null;
  onClose: () => void;
  onSave: (patch: {
    title: string;
    dateTime: Date;
    description: string;
  }) => void;
  onDelete: () => void;
  onMessage: () => void;
  onOpenLinkedList?: () => void;
  onCreateLinkedList?: () => void;
  saving?: boolean;
}) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderMins, setReminderMins] = useState<number | null>(null);
  const [checklist, setChecklist] = useState<PlanChecklistItem[]>([]);
  const [checklistDraft, setChecklistDraft] = useState('');
  const [completed, setCompleted] = useState(false);
  const [eventDate, setEventDate] = useState(new Date());
  const [eventTime, setEventTime] = useState(new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (!visible || !event) return;
    const meta = parsePlanMeta(event.description);
    const at = new Date(event.date_time);
    setTitle(event.title);
    setLocation(meta.location ?? '');
    setNotes(meta.notes ?? '');
    setReminderMins(meta.reminderMins ?? null);
    setChecklist(meta.checklist ?? []);
    setCompleted(!!meta.completed);
    setEventDate(at);
    setEventTime(at);
    setChecklistDraft('');
    setEditingTitle(false);
    dirty.current = false;
  }, [visible, event]);

  const countdown = useMemo(() => {
    if (!event) return null;
    const at = setMilliseconds(
      setSeconds(setMinutes(setHours(startOfDay(eventDate), eventTime.getHours()), eventTime.getMinutes()), 0),
      0,
    );
    return planCountdownParts(at);
  }, [event, eventDate, eventTime]);

  const checkProgress = useMemo(() => {
    const total = checklist.length;
    const doneCount = checklist.filter((c) => c.done).length;
    return { done: doneCount, total };
  }, [checklist]);

  if (!visible || !event) return null;

  const emoji = planKindEmoji(event) ?? EVENT_TYPE_META[event.type].emoji;
  const done = completed;

  const h24 = eventTime.getHours();
  const hour12 = h24 % 12 || 12;
  const minute = eventTime.getMinutes();
  const ampm: 'AM' | 'PM' = h24 < 12 ? 'AM' : 'PM';

  const buildMeta = (
    nextChecklist: PlanChecklistItem[],
    overrides: Partial<PlanMeta> = {},
  ): string => {
    const base = parsePlanMeta(event.description);
    return serializePlanMeta({
      ...base,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      reminderMins,
      checklist: nextChecklist.length ? nextChecklist : undefined,
      completed,
      ...overrides,
      v: 1,
    });
  };

  const persist = (nextChecklist = checklist, overrides: Partial<PlanMeta> = {}) => {
    dirty.current = false;
    const dateTime = setMilliseconds(
      setSeconds(setMinutes(setHours(startOfDay(eventDate), eventTime.getHours()), eventTime.getMinutes()), 0),
      0,
    );
    onSave({
      title: title.trim() || event.title,
      dateTime,
      description: buildMeta(nextChecklist, overrides),
    });
  };

  const closeSheet = () => {
    if (dirty.current) persist();
    onClose();
  };

  const toggleCheck = (id: string) => {
    Haptics.selectionAsync();
    const next = checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
    setChecklist(next);
    persist(next);
  };

  const markDone = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCompleted(true);
    persist(checklist, { completed: true });
  };

  const markUndone = () => {
    Haptics.selectionAsync();
    setCompleted(false);
    persist(checklist, { completed: false });
  };

  const confirmDelete = () => {
    Alert.alert('Delete plan?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onDelete();
        },
      },
    ]);
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={closeSheet} />
          <View style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}>
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

            <View style={styles.topBar}>
              <Pressable
                onPress={closeSheet}
                hitSlop={8}
                style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}>
                <Icon name="chevronLeft" size={18} color={colors.textSecondary} />
              </Pressable>
              <View style={styles.topActions}>
                <Pressable
                  onPress={() => persist()}
                  hitSlop={8}
                  style={[styles.iconBtn, { backgroundColor: colors.accentSoft }]}>
                  <Icon name="check" size={18} color={colors.accent} />
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  hitSlop={8}
                  style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}>
                  <Icon name="trash" size={18} color={colors.error} />
                </Pressable>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scroll}>
              <Text style={styles.heroEmoji}>{emoji}</Text>
              {editingTitle ? (
                <TextInput
                  value={title}
                  onChangeText={(t) => {
                    setTitle(t);
                    dirty.current = true;
                  }}
                  onBlur={() => setEditingTitle(false)}
                  autoFocus
                  style={[styles.heroTitleInput, { color: colors.text }]}
                />
              ) : (
                <Pressable onPress={() => setEditingTitle(true)}>
                  <Text
                    style={[
                      styles.heroTitle,
                      { color: colors.text, textDecorationLine: done ? 'line-through' : 'none' },
                    ]}>
                    {title}
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={() => setDateOpen(true)}>
                <Text style={[styles.heroMeta, { color: colors.textSecondary }]}>
                  {format(eventDate, 'EEEE, MMM d, yyyy')} · {format(eventTime, 'h:mm a')}
                </Text>
              </Pressable>
              {location ? (
                <View style={styles.locRow}>
                  <Icon name="location" size={14} color={colors.textTertiary} />
                  <Text style={[styles.locText, { color: colors.textTertiary }]}>{location}</Text>
                </View>
              ) : null}

              {user || partner ? (
                <View style={styles.people}>
                  {user ? <Avatar name={user.name} imageUrl={user.avatar_url} size={28} /> : null}
                  {partner ? <Avatar name={partner.name} imageUrl={partner.avatar_url} size={28} /> : null}
                  <Text style={{ color: colors.textTertiary, fontSize: 13, fontWeight: '600' }}>
                    Just you two
                  </Text>
                </View>
              ) : null}

              {countdown && !done ? (
                <View style={styles.countdown}>
                  <Text style={[styles.countdownLabel, { color: colors.accent }]}>Countdown</Text>
                  <Text style={[styles.countdownValue, { color: colors.accent }]}>
                    {String(countdown.days).padStart(2, '0')} days ·{' '}
                    {String(countdown.hours).padStart(2, '0')} hours ·{' '}
                    {String(countdown.mins).padStart(2, '0')} mins
                  </Text>
                </View>
              ) : null}

              {done ? (
                <View style={[styles.doneBanner, { backgroundColor: colors.accentSoft }]}>
                  <Icon name="checkDone" size={16} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontWeight: '700', flex: 1 }}>Completed</Text>
                  <Pressable onPress={markUndone}>
                    <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>Undo</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Checklist</Text>
                  <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>
                    {checkProgress.done} / {checkProgress.total}
                  </Text>
                </View>
                {checklist.map((item) => (
                  <Pressable key={item.id} onPress={() => toggleCheck(item.id)} style={styles.checkRow}>
                    <View
                      style={[
                        styles.checkBox,
                        {
                          borderColor: item.done ? colors.accent : colors.borderStrong,
                          backgroundColor: item.done ? colors.accent : 'transparent',
                        },
                      ]}>
                      {item.done ? <Icon name="check" size={12} color={colors.onAccent} /> : null}
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        color: item.done ? colors.textTertiary : colors.text,
                        textDecorationLine: item.done ? 'line-through' : 'none',
                        fontSize: 15,
                        fontWeight: '600',
                      }}>
                      {item.title}
                    </Text>
                  </Pressable>
                ))}
                <View style={styles.addCheckRow}>
                  <TextInput
                    value={checklistDraft}
                    onChangeText={setChecklistDraft}
                    placeholder="Add item"
                    placeholderTextColor={colors.textTertiary}
                    onSubmitEditing={() => {
                      const t = checklistDraft.trim();
                      if (!t) return;
                      const next = [...checklist, { id: `${Date.now()}`, title: t, done: false }];
                      setChecklist(next);
                      setChecklistDraft('');
                      persist(next);
                    }}
                    style={[styles.checkInput, { color: colors.text }]}
                  />
                  <Pressable
                    onPress={() => {
                      const t = checklistDraft.trim();
                      if (!t) return;
                      const next = [...checklist, { id: `${Date.now()}`, title: t, done: false }];
                      setChecklist(next);
                      setChecklistDraft('');
                      persist(next);
                    }}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>+ Add Item</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 8 }]}>Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={(t) => {
                    setNotes(t);
                    dirty.current = true;
                  }}
                  onBlur={() => {
                    if (dirty.current) persist();
                  }}
                  placeholder="Add a note…"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  style={[styles.notesInput, { color: colors.text }]}
                />
              </View>

              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 8 }]}>Shared list</Text>
                {linkedListTitle && onOpenLinkedList ? (
                  <Pressable onPress={onOpenLinkedList} style={styles.metaRow}>
                    <Text style={[styles.metaValue, { color: colors.text, textAlign: 'left' }]} numberOfLines={1}>
                      {linkedListTitle}
                    </Text>
                    <Icon name="chevronRight" size={16} color={colors.textTertiary} />
                  </Pressable>
                ) : onCreateLinkedList ? (
                  <Pressable onPress={onCreateLinkedList}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>+ Create list for this plan</Text>
                  </Pressable>
                ) : (
                  <Text style={{ color: colors.textTertiary, fontWeight: '500' }}>No list linked yet</Text>
                )}
              </View>

              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <Pressable onPress={() => setTimeOpen(true)} style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>Time</Text>
                  <Text style={[styles.metaValue, { color: colors.text }]}>{format(eventTime, 'h:mm a')}</Text>
                </Pressable>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>Location</Text>
                  <TextInput
                    value={location}
                    onChangeText={(t) => {
                      setLocation(t);
                      dirty.current = true;
                    }}
                    onBlur={() => {
                      if (dirty.current) persist();
                    }}
                    placeholder="Add location"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.metaInput, { color: colors.text }]}
                  />
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Pressable onPress={() => setReminderOpen(true)} style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>Reminder</Text>
                  <Text style={[styles.metaValue, { color: colors.text }]}>{reminderLabel(reminderMins)}</Text>
                </Pressable>
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={onMessage}
                  style={[styles.messageBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Icon name="chat" size={18} color={colors.accent} />
                  <Text style={[styles.messageLabel, { color: colors.accent }]}>Message</Text>
                </Pressable>
                <PrimaryButton
                  label={done ? 'Completed' : 'Mark as done'}
                  onPress={markDone}
                  disabled={done || saving}
                  style={styles.doneBtn}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PlanDateModal
        visible={dateOpen}
        value={eventDate}
        onClose={() => setDateOpen(false)}
        onConfirm={(day) => {
          setEventDate(day);
          setEventTime((t) => applyTimeParts(day, hour12, minute, ampm));
          setDateOpen(false);
          dirty.current = true;
        }}
      />

      <PlanTimeModal
        visible={timeOpen}
        hour12={hour12}
        minute={minute}
        period={ampm}
        onClose={() => setTimeOpen(false)}
        onConfirm={(h, m, p) => {
          setEventTime(applyTimeParts(eventDate, h, m, p));
          setTimeOpen(false);
          dirty.current = true;
        }}
      />

      <Modal visible={reminderOpen} transparent animationType="fade" onRequestClose={() => setReminderOpen(false)}>
        <Pressable style={styles.reminderBackdrop} onPress={() => setReminderOpen(false)}>
          <View style={[styles.reminderSheet, { backgroundColor: colors.backgroundElevated }]}>
            <Text style={[styles.reminderTitle, { color: colors.text }]}>Reminder</Text>
            {REMINDER_OPTIONS.map((opt) => (
              <Pressable
                key={String(opt.mins)}
                onPress={() => {
                  setReminderMins(opt.mins);
                  setReminderOpen(false);
                  persist(checklist, { reminderMins: opt.mins });
                }}
                style={styles.reminderRow}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{opt.label}</Text>
                {reminderMins === opt.mins ? <Icon name="check" size={18} color={colors.accent} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '94%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  topActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  heroEmoji: { fontSize: 36, marginBottom: -4 },
  heroTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heroTitleInput: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, padding: 0 },
  heroMeta: { fontSize: 15, fontWeight: '500', marginTop: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  locText: { fontSize: 14, fontWeight: '500' },
  people: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  countdown: { gap: 4, marginTop: 4 },
  countdownLabel: { fontSize: 13, fontWeight: '700' },
  countdownValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  card: { borderRadius: 14, padding: 16, gap: 4 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardMeta: { fontSize: 13, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  checkInput: { flex: 1, fontSize: 15, fontWeight: '600', padding: 0 },
  notesInput: {
    minHeight: 56,
    fontSize: 15,
    fontWeight: '500',
    textAlignVertical: 'top',
    padding: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  metaLabel: { fontSize: 13, fontWeight: '600', width: 80 },
  metaValue: { flex: 1, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  metaInput: { flex: 1, fontSize: 15, fontWeight: '600', textAlign: 'right', padding: 0 },
  divider: { height: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  messageLabel: { fontSize: 15, fontWeight: '700' },
  doneBtn: { flex: 1.2 },
  reminderBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  reminderSheet: { borderRadius: 20, padding: 16, gap: 4 },
  reminderTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
});
