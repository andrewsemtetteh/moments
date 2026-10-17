import { format, setHours, setMilliseconds, setMinutes, setSeconds, startOfDay } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';

import { ownerColor } from '@/components/calendar/plan/PlanDayView';
import { notInPast, PlanDateModal, PlanTimeModal } from '@/components/calendar/plan/PlanPickerModals';
import { FullScreenPage } from '@/components/layout/FullScreenPage';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { Icon } from '@/components/ui/Icon';
import { Avatar, colorWithAlpha, PrimaryButton, paperEdge } from '@/components/ui/primitives';
import { LinearGradient } from 'expo-linear-gradient';
import { getFirstName } from '@/lib/avatar-initial';
import { planOwner } from '@/lib/plan-day';
import { useTheme } from '@/hooks/useTheme';
import {
  parsePlanMeta,
  planCountdownParts,
  planIcon,
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
  event: eventProp,
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
    /** The plan being saved (it can save as the sheet closes, after the page let go of it). */
    id: string;
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
  // Keep showing the last plan while the sheet slides away, so closing it from
  // the page (Message, a linked list) animates instead of vanishing.
  const [kept, setKept] = useState(eventProp);
  if (eventProp && eventProp !== kept) setKept(eventProp);
  const event = eventProp ?? kept;
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

  // Filled from the plan each time one opens: per plan, not per object, so a save coming
  // back mustn't wipe what's being typed. Done while rendering, keyed on the plan.
  const openKey = visible && event ? event.id : null;
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (openKey !== null && event) {
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
    }
  }
  // Nothing typed yet for the plan just opened.
  useEffect(() => {
    dirty.current = false;
  }, [openKey]);

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

  if (!event) return null;

  const icon = planIcon(event);
  const done = completed;
  const owner = planOwner(event);
  const tint = ownerColor(owner, user?.id, colors);
  const people = owner === 'together' ? [user, partner] : owner === user?.id ? [user] : [partner];
  const forLabel =
    owner === 'together' ? 'Together' : owner === user?.id ? 'Just you' : `Just ${getFirstName(partner?.name) ?? 'your partner'}`;
  const passed = !!countdown && countdown.totalMs === 0;

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
      id: event.id,
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
      {/* A page of its own (slides in, back arrow, swipe right to go back), not a drawer. */}
      <FullScreenPage
        visible={visible && !!eventProp}
        title="Plan"
        onBack={closeSheet}
        avoidKeyboard={false}
        dismissKeyboardOnTap={false}
        right={
          <View style={styles.topActions}>
            <HeaderIconButton icon="trash" onPress={confirmDelete} accessibilityLabel="Delete plan" />
            <HeaderIconButton icon="check" onPress={() => persist()} accessibilityLabel="Save plan" />
          </View>
        }>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={styles.scroll}>
              {/* Hero: the plan in its colour, who it's for, and when (tap a chip to change it). */}
              <LinearGradient
                colors={[colorWithAlpha(tint, colors.isDark ? 0.34 : 0.2), colorWithAlpha(tint, colors.isDark ? 0.1 : 0.04)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.hero, { borderColor: colorWithAlpha(tint, 0.3) }]}>
                <View style={styles.heroTop}>
                  <View style={[styles.heroIcon, { backgroundColor: colors.surface }]}>
                    <Icon name={icon} size={26} color={tint} />
                  </View>
                  <View style={styles.heroPeople}>
                    <View style={styles.heroFaces}>
                      {people.map((person, i) => (
                        <View key={i} style={[styles.heroFace, i > 0 && styles.heroFaceOverlap, { borderColor: colors.surface }]}>
                          <Avatar name={person?.name} imageUrl={person?.avatar_url} size={28} />
                        </View>
                      ))}
                    </View>
                    <Text style={[styles.heroFor, { color: colors.textSecondary }]}>{forLabel}</Text>
                  </View>
                </View>

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
                  <Pressable onPress={() => setEditingTitle(true)} accessibilityRole="button" accessibilityHint="Rename this plan">
                    <Text
                      style={[styles.heroTitle, { color: colors.text, textDecorationLine: done ? 'line-through' : 'none' }]}>
                      {title}
                    </Text>
                  </Pressable>
                )}

                <View style={styles.chips}>
                  <Pressable
                    onPress={() => setDateOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Date, ${format(eventDate, 'EEEE d MMMM')}`}
                    style={({ pressed }) => [styles.chip, { backgroundColor: colors.surface }, paperEdge(colors), pressed && styles.chipPressed]}>
                    <Icon name="calendar" size={15} color={tint} />
                    <Text style={[styles.chipText, { color: colors.text }]}>{format(eventDate, 'EEE, MMM d')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTimeOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Time, ${format(eventTime, 'h:mm a')}`}
                    style={({ pressed }) => [styles.chip, { backgroundColor: colors.surface }, paperEdge(colors), pressed && styles.chipPressed]}>
                    <Icon name="time" size={15} color={tint} />
                    <Text style={[styles.chipText, { color: colors.text }]}>{format(eventTime, 'h:mm a')}</Text>
                  </Pressable>
                  {location ? (
                    <View style={[styles.chip, styles.chipShrink, { backgroundColor: colors.surface }, paperEdge(colors)]}>
                      <Icon name="location" size={15} color={tint} />
                      <Text style={[styles.chipText, styles.chipTextShrink, { color: colors.text }]} numberOfLines={1}>
                        {location}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </LinearGradient>

              {done ? (
                <View style={[styles.doneBanner, { backgroundColor: colors.accentSoft }]}>
                  <Icon name="checkDone" size={16} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontWeight: '700', flex: 1 }}>Completed</Text>
                  <Pressable onPress={markUndone}>
                    <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>Undo</Text>
                  </Pressable>
                </View>
              ) : passed ? (
                // Green like a past day with plans on the calendar.
                <View style={[styles.doneBanner, { backgroundColor: colorWithAlpha(colors.success, 0.14) }]}>
                  <Icon name="checkDone" size={16} color={colors.success} />
                  <Text style={{ color: colors.success, fontWeight: '700', flex: 1 }}>This happened</Text>
                </View>
              ) : countdown ? (
                <View style={styles.countdownRow}>
                  {[
                    { n: countdown.days, unit: countdown.days === 1 ? 'day' : 'days' },
                    { n: countdown.hours, unit: countdown.hours === 1 ? 'hour' : 'hours' },
                    { n: countdown.mins, unit: countdown.mins === 1 ? 'min' : 'mins' },
                  ].map((part) => (
                    <View key={part.unit} style={[styles.countTile, { backgroundColor: colors.surface }, paperEdge(colors)]}>
                      <Text style={[styles.countNum, { color: tint }]}>{String(part.n).padStart(2, '0')}</Text>
                      <Text style={[styles.countUnit, { color: colors.textSecondary }]}>{part.unit}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={[styles.card, { backgroundColor: colors.surface }, paperEdge(colors)]}>
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

              <View style={[styles.card, { backgroundColor: colors.surface }, paperEdge(colors)]}>
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

              <View style={[styles.card, { backgroundColor: colors.surface }, paperEdge(colors)]}>
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

              <View style={[styles.card, { backgroundColor: colors.surface }, paperEdge(colors)]}>
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

        {/* Pickers live inside this page's own Modal: on iPhone a second Modal
            opened beside an open one never shows, while one opened from inside it does. */}
        <PlanDateModal
          visible={dateOpen}
          value={eventDate}
          onClose={() => setDateOpen(false)}
          onConfirm={(day) => {
            setEventDate(day);
            setEventTime(() => notInPast(applyTimeParts(day, hour12, minute, ampm)));
            setDateOpen(false);
            dirty.current = true;
          }}
        />

        <PlanTimeModal
          visible={timeOpen}
          hour12={hour12}
          minute={minute}
          period={ampm}
          day={eventDate}
          onClose={() => setTimeOpen(false)}
          onConfirm={(h, m, p) => {
            setEventTime(applyTimeParts(eventDate, h, m, p));
            setTimeOpen(false);
            dirty.current = true;
          }}
        />

        <DraggableSheet visible={reminderOpen} onClose={() => setReminderOpen(false)} dragAnywhere>
          <Text style={[styles.reminderTitle, { color: colors.text }]}>Reminder</Text>
          {REMINDER_OPTIONS.map((opt) => (
            <Pressable
              key={String(opt.mins)}
              onPress={() => {
                setReminderMins(opt.mins);
                setReminderOpen(false);
                persist(checklist, { reminderMins: opt.mins });
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: reminderMins === opt.mins }}
              style={({ pressed }) => [styles.reminderRow, pressed && { opacity: 0.6 }]}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{opt.label}</Text>
              {reminderMins === opt.mins ? <Icon name="check" size={18} color={colors.accent} /> : null}
            </Pressable>
          ))}
        </DraggableSheet>
      </FullScreenPage>

    </>
  );
}

const styles = StyleSheet.create({
  topActions: { flexDirection: 'row', gap: 8 },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, gap: 14 },
  hero: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroPeople: { alignItems: 'flex-end', gap: 4 },
  heroFaces: { flexDirection: 'row' },
  heroFace: { borderWidth: 2, borderRadius: 16 },
  heroFaceOverlap: { marginLeft: -10 },
  heroFor: { fontSize: 12, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17 },
  chipPressed: { opacity: 0.7 },
  chipShrink: { flexShrink: 1, maxWidth: '100%' },
  chipText: { fontSize: 14, fontWeight: '700' },
  chipTextShrink: { flexShrink: 1 },
  countdownRow: { flexDirection: 'row', gap: 8 },
  countTile: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  countNum: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  countUnit: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  heroTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heroTitleInput: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, padding: 0 },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
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
  reminderTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
});
