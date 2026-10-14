import { format, setHours, setMilliseconds, setMinutes, setSeconds, startOfDay } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';

import { PlanDateModal, PlanTimeModal } from '@/components/calendar/plan/PlanPickerModals';
import { FullScreenPage, PageFooter } from '@/components/layout/FullScreenPage';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import {
  FAB_ACTIONS,
  PLAN_KIND_OPTIONS,
  REMINDER_OPTIONS,
  reminderLabel,
  serializePlanMeta,
  type PlanChecklistItem,
  type PlanKindKey,
  type PlanMeta,
} from '@/lib/plan-meta';
import type { EventType } from '@/types/database';

function resolveKind(key: PlanKindKey) {
  return (
    PLAN_KIND_OPTIONS.find((k) => k.key === key) ??
    FAB_ACTIONS.find((k) => k.key === key) ?? {
      key,
      label: 'Plan',
      emoji: '📌',
      icon: 'calendar' as const,
      eventType: 'custom' as EventType,
    }
  );
}
function defaultEventTime(base: Date): Date {
  const d = new Date(base);
  d.setHours(19, 0, 0, 0);
  return d;
}

function applyTimeParts(base: Date, h12: number, m: number, period: 'AM' | 'PM'): Date {
  const h24 = period === 'PM' ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
  return setMilliseconds(setSeconds(setMinutes(setHours(base, h24), m), 0), 0);
}

export type CreatePlanPayload = {
  title: string;
  type: EventType;
  dateTime: Date;
  description: string;
  kind: PlanKindKey;
  checklist: PlanChecklistItem[];
  createSharedList: boolean;
  attachedListIds: string[];
};

function titlePlaceholder(kind: PlanKindKey): string {
  switch (kind) {
    case 'date':
      return 'Dinner date';
    case 'trip':
      return 'Weekend getaway';
    case 'celebration':
      return 'Anniversary dinner';
    case 'activity':
      return 'Movie night';
    case 'outing':
      return 'Coffee walk';
    case 'reminder':
      return 'What should we remember?';
    case 'note':
      return 'Quick note';
    case 'goal':
      return 'Our goal';
    case 'checklist':
      return 'Shared checklist';
    default:
      return 'Title';
  }
}

export function CreatePlanFlow({
  visible,
  selectedDate,
  initialKind,
  skipTypePicker = false,
  existingLists = [],
  onClose,
  onSave,
  saving,
  meId,
  partnerName,
}: {
  visible: boolean;
  selectedDate: Date;
  initialKind?: PlanKindKey;
  skipTypePicker?: boolean;
  existingLists?: { id: string; title: string; emoji: string }[];
  onClose: () => void;
  onSave: (payload: CreatePlanPayload) => void;
  saving?: boolean;
  /** Your user id — a "Just me" plan is saved as yours. */
  meId?: string;
  /** Shown in the private hint ("Alex sees Busy"). */
  partnerName?: string;
}) {
  const { colors } = useTheme();
  const [, setStep] = useState<'type' | 'form'>('form');
  const [kindKey, setKindKey] = useState<PlanKindKey>('date');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderMins, setReminderMins] = useState<number | null>(60);
  const [checklist, setChecklist] = useState<PlanChecklistItem[]>([]);
  const [checklistDraft, setChecklistDraft] = useState('');
  const [createSharedList, setCreateSharedList] = useState(false);
  const [attachedListIds, setAttachedListIds] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState(selectedDate);
  const [eventTime, setEventTime] = useState(() => defaultEventTime(selectedDate));
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  // Whose plan: both of you, or just yours (shown in your lane on Upcoming).
  const [forWhom, setForWhom] = useState<'together' | 'me'>('together');
  const [isPrivate, setIsPrivate] = useState(false);

  const kind = resolveKind(kindKey);
  useEffect(() => {
    if (!visible) return;
    const base = selectedDate;
    setEventDate(base);
    setEventTime(defaultEventTime(base));
    setTitle('');
    setLocation('');
    setNotes('');
    setReminderMins(60);
    setChecklist([]);
    setChecklistDraft('');
    setAttachedListIds([]);
    setDateOpen(false);
    setTimeOpen(false);
    setReminderOpen(false);
    setForWhom('together');
    setIsPrivate(false);
    const nextKind = initialKind ?? 'date';
    setKindKey(nextKind);
    setCreateSharedList(
      nextKind === 'trip' || nextKind === 'celebration' || nextKind === 'checklist',
    );
    if (initialKind) {
      setStep('form');
    } else {
      setStep('form');
    }
  }, [visible, selectedDate, initialKind, skipTypePicker]);

  useEffect(() => {
    if (!visible) return;
    setCreateSharedList((prev) =>
      checklist.length > 0
        ? true
        : kindKey === 'trip' || kindKey === 'celebration' || kindKey === 'checklist' || prev,
    );
  }, [checklist.length, kindKey, visible]);

  const resolvedDateTime = useMemo(() => {
    const day = startOfDay(eventDate);
    return setMilliseconds(
      setSeconds(setMinutes(setHours(day, eventTime.getHours()), eventTime.getMinutes()), 0),
      0,
    );
  }, [eventDate, eventTime]);

  const h24 = eventTime.getHours();
  const hour12 = h24 % 12 || 12;
  const minute = eventTime.getMinutes();
  const ampm: 'AM' | 'PM' = h24 < 12 ? 'AM' : 'PM';

  const handleSave = () => {
    if (!title.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const meta: PlanMeta = {
      v: 1,
      kind: kindKey,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      reminderMins,
      checklist: checklist.length ? checklist : undefined,
      completed: false,
      owner: forWhom === 'me' && meId ? meId : undefined,
      private: forWhom === 'me' && isPrivate ? true : undefined,
      createdBy: meId,
    };
    onSave({
      title: title.trim(),
      type: kind.eventType,
      dateTime: resolvedDateTime,
      description: serializePlanMeta(meta),
      kind: kindKey,
      checklist,
      createSharedList: createSharedList || checklist.length > 0,
      attachedListIds,
    });
  };

  return (
    <>
      <FullScreenPage
        visible={visible}
        title="New plan"
        avoidKeyboard={false}
        onBack={onClose}
        right={
          saving ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <HeaderIconButton
              icon="check"
              onPress={handleSave}
              disabled={!title.trim()}
              accessibilityLabel="Save plan"
            />
          )
        }>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
                automaticallyAdjustKeyboardInsets
                contentContainerStyle={[styles.formScroll, styles.formFill]}>
                {/* No autoFocus: the keyboard waits until you tap the title. */}
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={titlePlaceholder(kindKey)}
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    styles.titleInput,
                    { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                />

                {/* Type picked right here (was a separate first page) — one sideways row. */}
                <GHScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.typeChipsScroll}
                  contentContainerStyle={styles.typeChips}>
                  {PLAN_KIND_OPTIONS.map((option) => {
                    const on = kindKey === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setKindKey(option.key);
                          setCreateSharedList(option.key === 'trip' || option.key === 'celebration');
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        style={[styles.chip, { backgroundColor: on ? colors.text : colors.surface }]}>
                        <Icon name={option.icon} size={18} color={on ? colors.background : colors.text} />
                        <Text style={[styles.chipText, { color: on ? colors.background : colors.text }]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </GHScrollView>

                <View style={[styles.whoRow, { backgroundColor: colors.surface }]}>
                  {(['together', 'me'] as const).map((who) => {
                    const on = forWhom === who;
                    return (
                      <Pressable
                        key={who}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setForWhom(who);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        style={[styles.whoBtn, on && { backgroundColor: colors.text }]}>
                        <Icon
                          name={who === 'together' ? 'people' : 'user'}
                          size={17}
                          color={on ? colors.background : colors.textSecondary}
                        />
                        <Text style={[styles.whoText, { color: on ? colors.background : colors.textSecondary }]}>
                          {who === 'together' ? 'Together' : 'Just me'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {forWhom === 'me' ? (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setIsPrivate((p) => !p);
                    }}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: isPrivate }}
                    style={[styles.privateRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Icon name="lock" size={16} color={isPrivate ? colors.accent : colors.textSecondary} />
                    <Text style={[styles.privateText, { color: colors.text }]}>
                      Private{' '}
                      <Text style={{ color: colors.textTertiary }}>
                        · {partnerName ?? 'Your partner'} sees “Busy”
                      </Text>
                    </Text>
                    <View
                      style={[
                        styles.privateCheck,
                        { borderColor: isPrivate ? colors.accent : colors.border },
                        isPrivate && { backgroundColor: colors.accent },
                      ]}>
                      {isPrivate ? <Icon name="check" size={14} color={colors.onAccent} /> : null}
                    </View>
                  </Pressable>
                ) : null}

                <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                    onChangeText={setLocation}
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
                    onChangeText={setNotes}
                    placeholder="Optional"
                    colors={colors}
                  />
                </View>

                <Text style={[styles.sectionLabel, { color: colors.accent }]}>Checklist</Text>
                <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {checklist.map((item) => (
                    <View key={item.id} style={styles.checkRow}>
                      <Pressable
                        onPress={() =>
                          setChecklist((prev) =>
                            prev.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c)),
                          )
                        }
                        style={[
                          styles.checkBox,
                          {
                            borderColor: item.done ? colors.accent : colors.borderStrong,
                            backgroundColor: item.done ? colors.accent : 'transparent',
                          },
                        ]}>
                        {item.done ? <Icon name="check" size={12} color={colors.onAccent} /> : null}
                      </Pressable>
                      <Text style={[styles.checkTitle, { color: colors.text }]}>{item.title}</Text>
                      <Pressable
                        onPress={() => setChecklist((prev) => prev.filter((c) => c.id !== item.id))}
                        hitSlop={8}>
                        <Icon name="close" size={16} color={colors.textTertiary} />
                      </Pressable>
                    </View>
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
                        setChecklist((prev) => [
                          ...prev,
                          { id: `${Date.now()}`, title: t, done: false },
                        ]);
                        setChecklistDraft('');
                      }}
                      style={[styles.checkInput, { color: colors.text }]}
                    />
                    <Pressable
                      onPress={() => {
                        const t = checklistDraft.trim();
                        if (!t) return;
                        setChecklist((prev) => [
                          ...prev,
                          { id: `${Date.now()}`, title: t, done: false },
                        ]);
                        setChecklistDraft('');
                      }}>
                      <Text style={{ color: colors.accent, fontWeight: '700' }}>+ Add</Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={[styles.sectionLabel, { color: colors.accent }]}>Shared list</Text>
                <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCreateSharedList((v) => !v);
                    }}
                    style={styles.checkRow}>
                    <View
                      style={[
                        styles.checkBox,
                        {
                          borderColor: createSharedList ? colors.accent : colors.borderStrong,
                          backgroundColor: createSharedList ? colors.accent : 'transparent',
                        },
                      ]}>
                      {createSharedList ? <Icon name="check" size={12} color={colors.onAccent} /> : null}
                    </View>
                    <Text style={[styles.checkTitle, { color: colors.text }]}>
                      Create a list for this plan
                    </Text>
                  </Pressable>
                  {existingLists.length > 0 ? (
                    <>
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                      <Text
                        style={{
                          color: colors.textTertiary,
                          fontSize: 12,
                          fontWeight: '600',
                          paddingHorizontal: 14,
                          paddingTop: 10,
                        }}>
                        Attach existing
                      </Text>
                      {existingLists.map((list) => {
                        const on = attachedListIds.includes(list.id);
                        return (
                          <Pressable
                            key={list.id}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setAttachedListIds((ids) =>
                                on ? ids.filter((id) => id !== list.id) : [...ids, list.id],
                              );
                            }}
                            style={styles.checkRow}>
                            <View
                              style={[
                                styles.checkBox,
                                {
                                  borderColor: on ? colors.accent : colors.borderStrong,
                                  backgroundColor: on ? colors.accent : 'transparent',
                                },
                              ]}>
                              {on ? <Icon name="check" size={12} color={colors.onAccent} /> : null}
                            </View>
                            <Icon name="list" size={16} color={colors.textSecondary} />
                            <Text style={[styles.checkTitle, { color: colors.text }]}>{list.title}</Text>
                          </Pressable>
                        );
                      })}
                    </>
                  ) : null}
                </View>

              </ScrollView>

              {/* Pinned under the form like New memory's — always in reach. */}
              <PageFooter hideWhileTyping>
                <PrimaryButton label="Save plan" onPress={handleSave} disabled={!title.trim()} loading={saving} />
              </PageFooter>
      </FullScreenPage>

      <PlanDateModal
        visible={dateOpen}
        value={eventDate}
        onClose={() => setDateOpen(false)}
        onConfirm={(day) => {
          setEventDate(day);
          setEventTime((t) => applyTimeParts(day, hour12, minute, ampm));
          setDateOpen(false);
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

export function FieldRow({
  label,
  value,
  onPress,
  colors,
}: {
  label: string;
  value: string;
  onPress: () => void;
  colors: { text: string; textTertiary: string };
}) {
  return (
    <Pressable onPress={onPress} style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Icon name="chevronRight" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

export function InlineInput({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  colors: { text: string; textTertiary: string };
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[styles.inlineInput, { color: colors.text }]}
      />
    </View>
  );
}

export function Divider({ colors }: { colors: { border: string } }) {
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '94%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 0,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  typePad: { paddingHorizontal: 20, paddingBottom: 12 },
  // Type chips — the same row on New plan and New memory.
  // Bleeds to the screen edges so chips scroll off-screen cleanly; flexGrow 0
  // keeps a horizontal ScrollView from stretching vertically.
  typeChipsScroll: { flexGrow: 0, marginHorizontal: -20 },
  typeChips: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 19 },
  chipText: { fontSize: 14, fontWeight: '700' },
  // Lets taps on the empty space under a short form reach the page (closes the keyboard).
  formFill: { flexGrow: 1 },
  typeHeader: { alignItems: 'flex-start', marginBottom: 8 },
  typeTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  typeCard: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 10,
  },
  typeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 15, fontWeight: '700' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formTitle: { fontSize: 17, fontWeight: '700' },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formTitleIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titleInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: '700',
  },
  whoRow: { flexDirection: 'row', padding: 4, borderRadius: 999 },
  whoBtn: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoText: { fontSize: 15, fontWeight: '800' },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  privateText: { flex: 1, fontSize: 15, fontWeight: '600' },
  privateCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', width: 78 },
  fieldValue: { flex: 1, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  inlineInput: { flex: 1, fontSize: 15, fontWeight: '600', textAlign: 'right', padding: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  addCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  checkInput: { flex: 1, fontSize: 15, fontWeight: '600', padding: 0 },
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

/** Shared with the Add memory form so both create sheets line up. */
export const createFormStyles = styles;
