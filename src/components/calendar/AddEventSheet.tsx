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

import { Icon, type IconName } from '@/components/ui/Icon';
import { MonthCalendarPicker } from '@/components/ui/MonthCalendarPicker';
import { PrimaryButton } from '@/components/ui/primitives';
import { TimePickerDropdown } from '@/components/ui/TimePickerDropdown';
import { EVENT_TYPE_META, EVENT_TYPES, getEventTypeColors } from '@/constants/calendar-events';
import type { ThemeColors } from '@/constants/design-system';
import { useLiveCountdown } from '@/hooks/useLiveCountdown';
import { useTheme } from '@/hooks/useTheme';
import { formatLiveCountdownBadge } from '@/lib/event-countdown';
import type { EventType } from '@/types/database';

function defaultEventTime(base: Date): Date {
  const d = new Date(base);
  d.setHours(19, 0, 0, 0);
  return d;
}

function applyTimeParts(base: Date, h12: number, m: number, period: 'AM' | 'PM'): Date {
  const h24 = period === 'PM' ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
  return setMilliseconds(setSeconds(setMinutes(setHours(base, h24), m), 0), 0);
}

function SectionTrigger({
  icon,
  label,
  value,
  open,
  onPress,
  colors,
  accent,
}: {
  icon: IconName;
  label: string;
  value: string;
  open: boolean;
  onPress: () => void;
  colors: ThemeColors;
  accent?: string;
}) {
  const activeColor = accent ?? colors.accent;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.trigger,
        {
          backgroundColor: open ? colors.accentSoft : colors.surface,
          borderColor: open ? activeColor : colors.border,
        },
      ]}>
      <View style={[styles.triggerIcon, { backgroundColor: open ? activeColor : colors.surfaceElevated }]}>
        <Icon name={icon} size={18} color={open ? colors.onAccent : colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.triggerLabel, { color: colors.textTertiary }]}>{label}</Text>
        <Text style={[styles.triggerValue, { color: colors.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
        <Icon name="chevronDown" size={18} color={open ? activeColor : colors.textSecondary} />
      </View>
    </Pressable>
  );
}

export function AddEventSheet({
  visible,
  selectedDate,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  selectedDate: Date | null;
  onClose: () => void;
  onSave: (payload: { title: string; type: EventType; dateTime: Date }) => void;
  saving?: boolean;
}) {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('date');
  const [eventDate, setEventDate] = useState<Date>(() => selectedDate ?? new Date());
  const [eventTime, setEventTime] = useState(() => defaultEventTime(selectedDate ?? new Date()));
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const typeColors = getEventTypeColors(type, colors);

  useEffect(() => {
    if (visible && selectedDate) {
      setEventDate(selectedDate);
      setEventTime(defaultEventTime(selectedDate));
      setTitle('');
      setType('date');
      setDateOpen(false);
      setTimeOpen(false);
    }
  }, [visible, selectedDate]);

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
  const cd = useLiveCountdown(resolvedDateTime);
  const countdownPreview = cd ? formatLiveCountdownBadge(cd, resolvedDateTime) : null;

  const toggleDate = () => {
    Haptics.selectionAsync();
    setTimeOpen(false);
    setDateOpen((v) => !v);
  };

  const toggleTime = () => {
    Haptics.selectionAsync();
    setDateOpen(false);
    setTimeOpen((v) => !v);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({ title: title.trim(), type, dateTime: resolvedDateTime });
  };

  if (!selectedDate) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}>
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View>
                <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>NEW PLAN</Text>
                <Text style={[styles.title, { color: colors.text }]}>Create event</Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceElevated }]}>
                <Icon name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={[styles.previewCard, { backgroundColor: typeColors.soft, borderColor: typeColors.main }]}>
              <View style={[styles.previewEmoji, { backgroundColor: colors.backgroundElevated }]}>
                <Text style={{ fontSize: 28 }}>{EVENT_TYPE_META[type].emoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: typeColors.main, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>
                  {EVENT_TYPE_META[type].label.toUpperCase()}
                </Text>
                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17 }} numberOfLines={1}>
                  {title.trim() || 'Untitled plan'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                  {format(resolvedDateTime, 'EEE, MMM d · h:mm a')}
                </Text>
              </View>
              {countdownPreview && (
                <View style={[styles.countdownPill, { backgroundColor: colors.backgroundElevated }]}>
                  <Text style={{ color: typeColors.main, fontSize: 11, fontWeight: '900' }}>{countdownPreview}</Text>
                </View>
              )}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Dinner, movie night, anniversary…"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              />
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>When</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SectionTrigger
                icon="calendar"
                label="Date"
                value={format(eventDate, 'EEEE, MMMM d')}
                open={dateOpen}
                onPress={toggleDate}
                colors={colors}
                accent={typeColors.main}
              />
              {dateOpen && (
                <View style={[styles.pickerPanel, { borderColor: colors.border }]}>
                  <MonthCalendarPicker
                    value={eventDate}
                    selectedDateTime={resolvedDateTime}
                    onChange={(day) => {
                      setEventDate(day);
                      setEventTime((t) => applyTimeParts(day, hour12, minute, ampm));
                    }}
                  />
                </View>
              )}

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <SectionTrigger
                icon="moon"
                label="Time"
                value={format(eventTime, 'h:mm a')}
                open={timeOpen}
                onPress={toggleTime}
                colors={colors}
                accent={typeColors.main}
              />
              {timeOpen && (
                <View style={[styles.pickerPanel, { borderColor: colors.border }]}>
                  <TimePickerDropdown
                    hour12={hour12}
                    minute={minute}
                    period={ampm}
                    onChange={(h, m, p) => setEventTime(applyTimeParts(eventDate, h, m, p))}
                  />
                </View>
              )}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Type</Text>
            <View style={styles.typeList}>
              {EVENT_TYPES.map((t) => {
                const meta = EVENT_TYPE_META[t];
                const tc = getEventTypeColors(t, colors);
                const active = type === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setType(t);
                    }}
                    style={[
                      styles.typeRow,
                      {
                        backgroundColor: active ? tc.soft : colors.surface,
                        borderColor: active ? tc.main : colors.border,
                      },
                    ]}>
                    <View style={[styles.typeIcon, { backgroundColor: active ? tc.main : colors.surfaceElevated }]}>
                      <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{meta.label}</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{meta.description}</Text>
                    </View>
                    <View
                      style={[
                        styles.typeCheck,
                        {
                          backgroundColor: active ? tc.main : 'transparent',
                          borderColor: active ? tc.main : colors.borderStrong,
                        },
                      ]}>
                      {active && <Icon name="check" size={14} color={tc.onMain} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <PrimaryButton
              label="Add to plan"
              onPress={handleSave}
              disabled={!title.trim()}
              loading={saving}
              style={{ marginTop: 20 }}
            />
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    maxHeight: '94%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10, marginBottom: 18 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '900' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 22,
  },
  previewEmoji: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 10 },
  sectionCard: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 4, marginBottom: 18, overflow: 'hidden' },
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginHorizontal: 14, marginTop: 12, marginBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    marginHorizontal: 10,
    marginBottom: 12,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 6,
    marginVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  triggerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  triggerLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  triggerValue: { fontSize: 15, fontWeight: '800' },
  pickerPanel: {
    marginHorizontal: 10,
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16, marginVertical: 4 },
  typeList: { gap: 10, marginBottom: 8 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  typeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  typeCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 4 },
});
