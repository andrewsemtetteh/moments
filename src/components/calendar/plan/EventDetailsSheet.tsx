import { format, setHours, setMilliseconds, setMinutes, setSeconds, startOfDay } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';

import { notInPast, PlanDateModal, PlanTimeModal } from '@/components/calendar/plan/PlanPickerModals';
import { Divider, FieldRow, InlineInput, createFormStyles as form } from '@/components/calendar/plan/CreatePlanFlow';
import { FullScreenPage, PageFooter } from '@/components/layout/FullScreenPage';
import { SettingsChoiceSheet } from '@/components/profile/SettingsEditPage';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { Icon } from '@/components/ui/Icon';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { Avatar, cardSurface, colorWithAlpha, trackColor } from '@/components/ui/primitives';
import { getFirstName } from '@/lib/avatar-initial';
import { planOwner } from '@/lib/plan-day';
import { useTheme } from '@/hooks/useTheme';
import {
  parsePlanMeta,
  planCountdownParts,
  reminderLabel,
  serializePlanMeta,
  REMINDER_OPTIONS,
  type PlanChecklistItem,
  type PlanMeta,
} from '@/lib/plan-meta';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { CalendarEvent } from '@/types/database';
import { askChoice } from '@/components/ui/ChoiceSheet';

/** An id for a new checklist item (the time it was added). */
function newChecklistId() {
  return `${Date.now()}`;
}

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
  onSendMessage,
  onOpenLinkedList,
  onCreateLinkedList,
  saving,
  listSheet,
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
  /** Open Chat. */
  onMessage: () => void;
  /** Send a message about this plan to chat (the plan goes with it as a card). */
  onSendMessage?: (text: string) => Promise<void>;
  onOpenLinkedList?: () => void;
  onCreateLinkedList?: () => void;
  saving?: boolean;
  /** The shared list, opened over this page (inside its Modal, so closing it comes back here). */
  listSheet?: ReactNode;
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
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [sentNote, setSentNote] = useState(false);
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
      setReplyOpen(false);
      setReplyText('');
      setSentNote(false);
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

  const done = completed;
  const owner = planOwner(event);
  const people = owner === 'together' ? [user, partner] : owner === user?.id ? [user] : [partner];
  const forLabel =
    owner === 'together' ? 'Together' : owner === user?.id ? 'Just you' : `Just ${getFirstName(partner?.name) ?? 'your partner'}`;
  const passed = !!countdown && countdown.totalMs === 0;
  // The Together cards' look (as the Trophy shelf): a raised fill and a clear outline.
  const card = cardSurface(colors);
  const shelfCard = card;

  const removeCheck = (id: string) => {
    Haptics.selectionAsync();
    const next = checklist.filter((c) => c.id !== id);
    setChecklist(next);
    persist(next);
  };

  const addChecklistItem = () => {
    const t = checklistDraft.trim();
    if (!t) return;
    const next = [...checklist, { id: newChecklistId(), title: t, done: false }];
    setChecklist(next);
    setChecklistDraft('');
    persist(next);
  };

  const sendReply = async () => {
    if (!onSendMessage || sendingReply) return;
    setSendingReply(true);
    try {
      await onSendMessage(replyText.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReplyOpen(false);
      setReplyText('');
      setSentNote(true);
    } catch (e) {
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Check your connection and try again.');
    } finally {
      setSendingReply(false);
    }
  };
  const progress = checkProgress.total ? checkProgress.done / checkProgress.total : 0;

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
    askChoice({ title: 'Delete plan?', message: 'This cannot be undone.', actions: [
{ label: 'Delete', destructive: true, onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onDelete();
        } },
] });
  };

  return (
    <>
      {/* A page of its own (slides in, back arrow, swipe right to go back), not a drawer. */}
      <FullScreenPage
        visible={visible && !!eventProp}
        title="Plan"
        onBack={closeSheet}
        // A tap anywhere that isn't a field or button (header and footer too) closes the keyboard.
        dismissKeyboardOnTap
        right={
          <View style={styles.topActions}>
            <HeaderIconButton icon="trash" onPress={confirmDelete} accessibilityLabel="Delete plan" />
            <HeaderIconButton icon="check" onPress={() => persist()} accessibilityLabel="Save plan" />
          </View>
        }>
            {/* The page shrinks above the keyboard here (its footer rides on it), so no extra space. */}
            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              addKeyboardSpace={false}
              // The pinned Message / Done bar already clears the home indicator.
              bottomSpace={12}
              contentContainerStyle={styles.scroll}>
              {/* Laid out like New plan: who it's for and how soon, the title, one grouped list of
                  rows, then the checklist and the shared list. */}
              <View style={[styles.forRow, card]}>
                <View style={styles.heroFaces}>
                  {people.map((person, i) => (
                    <View key={i} style={[styles.heroFace, i > 0 && styles.heroFaceOverlap, { borderColor: colors.surface }]}>
                      <Avatar name={person?.name} imageUrl={person?.avatar_url} size={26} />
                    </View>
                  ))}
                </View>
                <View style={styles.forCopy}>
                  <Text style={[styles.forLabel, { color: colors.text }]}>{forLabel}</Text>
                </View>
                {done ? (
                  <View accessible accessibilityLabel="Done" style={[styles.statusDot, { backgroundColor: colors.accent }]}>
                    <Icon name="checkDone" size={18} color={colors.onAccent} />
                  </View>
                ) : passed ? (
                  <View accessible accessibilityLabel="This happened" style={[styles.statusDot, { backgroundColor: colorWithAlpha(colors.success, 0.16) }]}>
                    <Icon name="checkDone" size={18} color={colors.success} />
                  </View>
                ) : countdown ? (
                  <View style={[styles.statusPill, { backgroundColor: colors.accentSoft }]}>
                    <Icon name="time" size={14} color={colors.accent} />
                    <Text style={[styles.statusText, { color: colors.accent }]}>
                      {countdown.days
                        ? `${countdown.days}d ${countdown.hours}h`
                        : countdown.hours
                          ? `${countdown.hours}h ${countdown.mins}m`
                          : `${countdown.mins}m`}
                    </Text>
                  </View>
                ) : null}
              </View>

              <TextInput
                value={title}
                onChangeText={(t) => {
                  setTitle(t);
                  dirty.current = true;
                }}
                onBlur={() => {
                  if (dirty.current) persist();
                }}
                placeholder="Plan name"
                placeholderTextColor={colors.textTertiary}
                style={[
                  form.titleInput,
                  card,
                  { color: colors.text, textDecorationLine: done ? 'line-through' : 'none' },
                ]}
              />

              <View style={[form.group, card]}>
                <FieldRow
                  label="Date"
                  value={format(eventDate, 'EEEE, MMM d, yyyy')}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDateOpen(true);
                  }}
                  colors={colors}
                />
                <Divider colors={colors} />
                <FieldRow
                  label="Time"
                  value={format(eventTime, 'h:mm a')}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTimeOpen(true);
                  }}
                  colors={colors}
                />
                <Divider colors={colors} />
                <InlineInput
                  label="Location"
                  value={location}
                  onChangeText={(t) => {
                    setLocation(t);
                    dirty.current = true;
                  }}
                  placeholder="Optional"
                  colors={colors}
                />
                <Divider colors={colors} />
                <FieldRow
                  label="Reminder"
                  value={reminderLabel(reminderMins)}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setReminderOpen(true);
                  }}
                  colors={colors}
                />
                <Divider colors={colors} />
                <InlineInput
                  label="Notes"
                  value={notes}
                  onChangeText={(t) => {
                    setNotes(t);
                    dirty.current = true;
                  }}
                  placeholder="Optional"
                  colors={colors}
                />
              </View>

              <View style={styles.sectionHead}>
                <Text style={[form.sectionLabel, styles.sectionLabelFlush, { color: colors.accent }]}>Checklist</Text>
                {checkProgress.total ? (
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                    {checkProgress.done} of {checkProgress.total}
                  </Text>
                ) : null}
              </View>
              <View style={[form.group, card]}>
                {checkProgress.total ? (
                  <View style={[styles.progressTrack, styles.progressInset, { backgroundColor: trackColor(colors) }]}>
                    <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                ) : null}
                {checklist.map((item) => (
                  <View key={item.id} style={form.checkRow}>
                    <Pressable
                      onPress={() => toggleCheck(item.id)}
                      hitSlop={6}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: item.done }}
                      style={[
                        form.checkBox,
                        {
                          borderColor: item.done ? colors.accent : colors.borderStrong,
                          backgroundColor: item.done ? colors.accent : 'transparent',
                        },
                      ]}>
                      {item.done ? <Icon name="check" size={12} color={colors.onAccent} /> : null}
                    </Pressable>
                    <Text
                      style={[
                        form.checkTitle,
                        {
                          color: item.done ? colors.textTertiary : colors.text,
                          textDecorationLine: item.done ? 'line-through' : 'none',
                        },
                      ]}>
                      {item.title}
                    </Text>
                    <Pressable onPress={() => removeCheck(item.id)} hitSlop={8} accessibilityLabel={`Remove ${item.title}`}>
                      <Icon name="close" size={16} color={colors.textTertiary} />
                    </Pressable>
                  </View>
                ))}
                <View style={form.addCheckRow}>
                  <TextInput
                    value={checklistDraft}
                    onChangeText={setChecklistDraft}
                    placeholder="Add item"
                    placeholderTextColor={colors.textTertiary}
                    returnKeyType="done"
                    onSubmitEditing={addChecklistItem}
                    style={[form.checkInput, { color: colors.text }]}
                  />
                  <Pressable onPress={addChecklistItem} hitSlop={8} accessibilityRole="button">
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>+ Add</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={[form.sectionLabel, { color: colors.accent }]}>Shared list</Text>
              <View style={[form.group, card]}>
                <Pressable
                  onPress={linkedListTitle && onOpenLinkedList ? onOpenLinkedList : onCreateLinkedList}
                  disabled={!(linkedListTitle && onOpenLinkedList) && !onCreateLinkedList}
                  accessibilityRole="button"
                  style={({ pressed }) => [form.checkRow, pressed && styles.chipPressed]}>
                  <Icon name={linkedListTitle ? 'list' : 'plus'} size={17} color={linkedListTitle ? colors.text : colors.accent} />
                  <Text
                    style={[form.checkTitle, { color: linkedListTitle ? colors.text : colors.accent }]}
                    numberOfLines={1}>
                    {linkedListTitle ?? (onCreateLinkedList ? 'Create a list for this plan' : 'No list linked yet')}
                  </Text>
                  {linkedListTitle ? <Icon name="chevronRight" size={16} color={colors.textTertiary} /> : null}
                </Pressable>
              </View>
            </KeyboardAwareScrollView>

            <PageFooter>
              {sentNote ? (
                <View style={[styles.sentNote, { backgroundColor: colorWithAlpha(colors.success, 0.14) }]}>
                  <Icon name="checkDone" size={15} color={colors.success} />
                  <Text style={[styles.sentNoteText, { color: colors.text }]}>Sent to chat</Text>
                  <Pressable onPress={onMessage} hitSlop={8} accessibilityRole="button">
                    <Text style={[styles.sentNoteAction, { color: colors.text }]}>Open chat</Text>
                  </Pressable>
                </View>
              ) : null}
              {replyOpen ? (
                // Say something about this plan: it goes to chat with the plan as a card.
                <View style={styles.replyRow}>
                  <Pressable
                    onPress={() => {
                      setReplyOpen(false);
                      setReplyText('');
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel message"
                    style={[styles.replyCancel, shelfCard]}>
                    <Icon name="close" size={16} color={colors.text} />
                  </Pressable>
                  <TextInput
                    value={replyText}
                    onChangeText={setReplyText}
                    placeholder={`Message about “${title || event.title}”…`}
                    placeholderTextColor={colors.textTertiary}
                    autoFocus
                    multiline
                    maxLength={1000}
                    style={[styles.replyInput, shelfCard, { color: colors.text }]}
                  />
                  <Pressable
                    onPress={() => void sendReply()}
                    disabled={sendingReply}
                    accessibilityRole="button"
                    accessibilityLabel="Send to chat"
                    style={({ pressed }) => [styles.replySend, { backgroundColor: colors.text }, pressed && styles.chipPressed]}>
                    {sendingReply ? (
                      <ActivityIndicator color={colors.background} />
                    ) : (
                      <Icon name="send" size={18} color={colors.background} />
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      if (onSendMessage) setReplyOpen(true);
                      else onMessage();
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.messageBtn, shelfCard, pressed && styles.chipPressed]}>
                    <Icon name="chat" size={18} color={colors.text} />
                    <Text style={[styles.messageLabel, { color: colors.text }]}>Message</Text>
                  </Pressable>
                  {/* Done / not done: one round tick (filled once it's done; tap again to undo). */}
                  <Pressable
                    onPress={done ? markUndone : markDone}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel={done ? 'Done. Mark as not done' : 'Mark as done'}
                    accessibilityState={{ checked: done }}
                    style={({ pressed }) => [
                      styles.doneRound,
                      done ? { backgroundColor: colors.accent } : shelfCard,
                      pressed && styles.chipPressed,
                    ]}>
                    <Icon name="checkDone" size={26} color={done ? colors.onAccent : colors.text} />
                  </Pressable>
                </View>
              )}
            </PageFooter>

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

        {listSheet}

        <SettingsChoiceSheet
          visible={reminderOpen}
          title="Reminder"
          hint="We'll remind you both before it starts."
          options={REMINDER_OPTIONS.map((opt) => ({ value: String(opt.mins), label: opt.label }))}
          value={String(reminderMins)}
          onSelect={(v) => {
            const mins = v === 'null' ? null : Number(v);
            setReminderMins(mins);
            setReminderOpen(false);
            persist(checklist, { reminderMins: mins });
          }}
          onClose={() => setReminderOpen(false)}
        />
      </FullScreenPage>

    </>
  );
}

const styles = StyleSheet.create({
  topActions: { flexDirection: 'row', gap: 8 },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 14 },
  hero: { borderRadius: 26, padding: 18, gap: 14, overflow: 'hidden' },
  heroWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
  forRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  forCopy: { flex: 1, minWidth: 0, gap: 2 },
  forLabel: { fontSize: 15, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  sectionLabelFlush: { marginTop: 0 },
  progressInset: { marginHorizontal: 14, marginTop: 12, marginBottom: 0 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  forPill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingLeft: 5, paddingRight: 12, borderRadius: 17 },
  heroFaces: { flexDirection: 'row' },
  heroFace: { borderWidth: 2, borderRadius: 13 },
  heroFaceOverlap: { marginLeft: -9 },
  heroFor: { fontSize: 13, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroTitle: { flexShrink: 1, fontSize: 28, fontWeight: '900', letterSpacing: -0.6, lineHeight: 33 },
  heroTitleInput: { fontSize: 28, fontWeight: '900', letterSpacing: -0.6, padding: 0 },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  statusText: { fontSize: 14, fontWeight: '800' },
  statusDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  doneRound: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  statusAction: { fontSize: 13, fontWeight: '800', textDecorationLine: 'underline', marginLeft: 4 },
  ticket: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 8 },
  ticketHalf: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 4 },
  ticketDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 6 },
  dateBlock: { width: 46, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dateBlockMonth: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  dateBlockDay: { fontSize: 20, fontWeight: '900', lineHeight: 23, fontVariant: ['tabular-nums'] },
  ticketCopy: { flex: 1, minWidth: 0, gap: 1 },
  ticketLabel: { fontSize: 12, fontWeight: '700' },
  ticketValue: { fontSize: 15, fontWeight: '800' },
  chipPressed: { opacity: 0.7 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { fontSize: 12, fontWeight: '700' },
  rowValue: { fontSize: 15, fontWeight: '700' },
  rowInput: { fontSize: 15, fontWeight: '700', padding: 0 },
  checkText: { flex: 1, fontSize: 15, fontWeight: '600' },
  addText: { fontSize: 14, fontWeight: '800' },
  card: { borderRadius: 22, padding: 16, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  cardIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  cardMeta: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  cardHint: { fontSize: 13, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: 6, borderRadius: 3 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 14, marginTop: 6 },
  checkInput: { flex: 1, fontSize: 15, fontWeight: '600', padding: 0 },
  notesInput: {
    minHeight: 56,
    fontSize: 15,
    fontWeight: '500',
    textAlignVertical: 'top',
    padding: 0,
  },
  divider: { height: 1 },
  actions: { flexDirection: 'row', gap: 10 },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  replyCancel: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  replyInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  replySend: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  sentNoteText: { flex: 1, fontSize: 14, fontWeight: '700' },
  sentNoteAction: { fontSize: 14, fontWeight: '800', textDecorationLine: 'underline' },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
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
