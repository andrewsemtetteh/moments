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
import { Icon, type IconName } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { getEventTypeColors } from '@/constants/calendar-events';
import { Radius, type ThemeColors } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import type { EventType } from '@/types/database';

type PlanKind = {
  key: string;
  label: string;
  type: EventType;
  titleHint?: string;
};

const PLAN_KINDS: PlanKind[] = [
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'trip', label: 'Trip', type: 'experience', titleHint: 'Weekend Trip' },
  { key: 'reminder', label: 'Reminder', type: 'reminder' },
  { key: 'anniversary', label: 'Anniversary', type: 'anniversary' },
  { key: 'birthday', label: 'Birthday', type: 'custom', titleHint: 'Birthday' },
  { key: 'custom', label: 'Custom', type: 'custom' },
];

function defaultEventTime(base: Date): Date {
  const d = new Date(base);
  d.setHours(19, 0, 0, 0);
  return d;
}

function applyTimeParts(base: Date, h12: number, m: number, period: 'AM' | 'PM'): Date {
  const h24 = period === 'PM' ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
  return setMilliseconds(setSeconds(setMinutes(setHours(base, h24), m), 0), 0);
}

function FieldRow({
  icon,
  label,
  value,
  onPress,
  colors,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable onPress={onPress} style={styles.fieldRow}>
      <Icon name={icon} size={18} color={colors.textSecondary} />
      <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Icon name="chevronRight" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

export function AddEventSheet({
  visible,
  selectedDate,
  onClose,
  onSave,
  saving,
  initialType = 'date',
  initialTitle = '',
}: {
  visible: boolean;
  selectedDate: Date | null;
  onClose: () => void;
  onSave: (payload: { title: string; type: EventType; dateTime: Date }) => void;
  saving?: boolean;
  initialType?: EventType;
  initialTitle?: string;
}) {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [kindKey, setKindKey] = useState('date');
  const [eventDate, setEventDate] = useState<Date>(() => selectedDate ?? new Date());
  const [eventTime, setEventTime] = useState(() => defaultEventTime(selectedDate ?? new Date()));
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const kind = PLAN_KINDS.find((k) => k.key === kindKey) ?? PLAN_KINDS[0];

  useEffect(() => {
    if (!visible) return;
    const base = selectedDate ?? new Date();
    setEventDate(base);
    setEventTime(defaultEventTime(base));
    setTitle(initialTitle);
    const matched =
      PLAN_KINDS.find((k) => k.titleHint && initialTitle === k.titleHint) ??
      PLAN_KINDS.find((k) => k.type === initialType && k.key !== 'birthday') ??
      PLAN_KINDS[0];
    setKindKey(matched.key);
    setDateOpen(false);
    setTimeOpen(false);
  }, [visible, selectedDate, initialType, initialTitle]);

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
    onSave({ title: title.trim(), type: kind.type, dateTime: resolvedDateTime });
  };

  if (!visible) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}>
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scroll}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>New plan</Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={[styles.closeBtn, { backgroundColor: colors.surfaceElevated }]}>
                  <Icon name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What are you planning?"
                placeholderTextColor={colors.textTertiary}
                autoFocus
                style={[
                  styles.input,
                  { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.kindRow}
                style={styles.kindScroll}>
                {PLAN_KINDS.map((k) => {
                  const active = kindKey === k.key;
                  const tc = getEventTypeColors(k.type, colors);
                  return (
                    <Pressable
                      key={k.key}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setKindKey(k.key);
                        if (k.titleHint && !title.trim()) setTitle(k.titleHint);
                      }}
                      style={[
                        styles.kindChip,
                        {
                          backgroundColor: active ? tc.soft : colors.surface,
                          borderColor: active ? tc.main : colors.border,
                        },
                      ]}>
                      <View style={[styles.kindDot, { backgroundColor: tc.main }]} />
                      <Text
                        style={{
                          color: active ? tc.main : colors.textSecondary,
                          fontWeight: '700',
                          fontSize: 13,
                        }}>
                        {k.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={[styles.whenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <FieldRow
                  icon="calendar"
                  label="Date"
                  value={format(eventDate, 'EEE, MMM d')}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDateOpen(true);
                  }}
                  colors={colors}
                />
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <FieldRow
                  icon="time"
                  label="Time"
                  value={format(eventTime, 'h:mm a')}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTimeOpen(true);
                  }}
                  colors={colors}
                />
              </View>

              <PrimaryButton
                label="Add to plan"
                onPress={handleSave}
                disabled={!title.trim()}
                loading={saving}
                style={{ marginTop: 4 }}
              />
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
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  scroll: { paddingBottom: 12, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 17,
    fontWeight: '600',
  },
  kindScroll: { marginHorizontal: -4 },
  kindRow: { gap: 8, paddingHorizontal: 4 },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  kindDot: { width: 7, height: 7, borderRadius: 4 },
  whenCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', width: 42 },
  fieldValue: { flex: 1, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
});
