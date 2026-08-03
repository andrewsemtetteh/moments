import { format, setHours, setMilliseconds, setMinutes, setSeconds, startOfDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import {
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
}: {
  visible: boolean;
  selectedDate: Date;
  initialKind?: PlanKindKey;
  skipTypePicker?: boolean;
  existingLists?: { id: string; title: string; emoji: string }[];
  onClose: () => void;
  onSave: (payload: CreatePlanPayload) => void;
  saving?: boolean;
}) {
  const { colors } = useTheme();
  const [step, setStep] = useState<'type' | 'form'>('type');
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
    const nextKind = initialKind ?? 'date';
    setKindKey(nextKind);
    setCreateSharedList(
      nextKind === 'trip' || nextKind === 'celebration' || nextKind === 'checklist',
    );
    if (initialKind) {
      setStep(skipTypePicker || initialKind ? 'form' : 'type');
    } else {
      setStep(skipTypePicker ? 'form' : 'type');
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

  if (!visible) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}>
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

            {step === 'type' ? (
              <View style={styles.typePad}>
                <View style={styles.typeHeader}>
                  <Pressable
                    onPress={onClose}
                    hitSlop={8}
                    style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}>
                    <Icon name="close" size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <Text style={[styles.typeTitle, { color: colors.accent }]}>What are you planning?</Text>
                <View style={styles.grid}>
                  {PLAN_KIND_OPTIONS.map((option) => {
                    const active = kindKey === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setKindKey(option.key);
                          setCreateSharedList(
                            option.key === 'trip' ||
                              option.key === 'celebration' ||
                              option.key === 'checklist',
                          );
                          setStep('form');
                        }}
                        style={[
                          styles.typeCard,
                          {
                            backgroundColor: colors.surface,
                            borderColor: active ? colors.accent : colors.border,
                          },
                        ]}>
                        <Text style={styles.typeEmoji}>{option.emoji}</Text>
                        <Text style={[styles.typeLabel, { color: colors.text }]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.formScroll}>
                <View style={styles.formHeader}>
                  <Pressable
                    onPress={() => {
                      if (skipTypePicker && initialKind) onClose();
                      else setStep('type');
                    }}
                    hitSlop={8}
                    style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}>
                    <Icon name="chevronLeft" size={18} color={colors.textSecondary} />
                  </Pressable>
                  <Text style={[styles.formTitle, { color: colors.text }]}>
                    New {kind.label}
                  </Text>
                  <Pressable
                    onPress={handleSave}
                    disabled={!title.trim() || saving}
                    hitSlop={8}
                    style={[
                      styles.iconBtn,
                      {
                        backgroundColor: title.trim() ? colors.accentSoft : colors.surfaceElevated,
                        opacity: title.trim() ? 1 : 0.5,
                      },
                    ]}>
                    <Icon name="check" size={18} color={title.trim() ? colors.accent : colors.textTertiary} />
                  </Pressable>
                </View>

                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={titlePlaceholder(kindKey)}
                  placeholderTextColor={colors.textTertiary}
                  autoFocus
                  style={[
                    styles.titleInput,
                    { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                />

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
                            <Text style={[styles.checkTitle, { color: colors.text }]}>
                              {list.emoji} {list.title}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </>
                  ) : null}
                </View>

                <PrimaryButton
                  label="Save plan"
                  onPress={handleSave}
                  disabled={!title.trim()}
                  loading={saving}
                  style={{ marginTop: 4 }}
                />
              </ScrollView>
            )}
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

function FieldRow({
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

function InlineInput({
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

function Divider({ colors }: { colors: { border: string } }) {
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
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
  typePad: { paddingHorizontal: 20, paddingBottom: 12 },
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
  typeEmoji: { fontSize: 32 },
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
  titleInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: '700',
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
