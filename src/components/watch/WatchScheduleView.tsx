import {
  addDays,
  addHours,
  format,
  isSameDay,
  roundToNearestMinutes,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
  startOfDay,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PlatformConnectGrid } from '@/components/watch/PlatformConnectGrid';
import { WatchScreen } from '@/components/watch/WatchScreen';
import { Icon, type IconName } from '@/components/ui/Icon';
import { MonthCalendarPicker, type CalendarDayMarker } from '@/components/ui/MonthCalendarPicker';
import { PrimaryButton } from '@/components/ui/primitives';
import { TimePickerDropdown } from '@/components/ui/TimePickerDropdown';
import type { StreamingPlatformId } from '@/constants/streaming-platforms';
import { getStreamingPlatform } from '@/constants/streaming-platforms';
import { WATCH_REMINDER_OPTIONS } from '@/constants/watch-together';
import { useUpcomingSessions, useWatchSessionMutations } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import type { ThemeColors } from '@/constants/design-system';

const MAX_SCHEDULE_DAYS = 60;

function defaultScheduledAt(): Date {
  return roundToNearestMinutes(addHours(new Date(), 2), { nearestTo: 15 });
}

function applyDay(base: Date, day: Date): Date {
  return setMilliseconds(
    setSeconds(setMinutes(setHours(startOfDay(day), base.getHours()), base.getMinutes()), 0),
    0,
  );
}

function applyTimeParts(base: Date, h12: number, m: number, period: 'AM' | 'PM'): Date {
  const h24 = period === 'PM' ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
  return setMilliseconds(setSeconds(setMinutes(setHours(base, h24), m), 0), 0);
}

function buildCalendarMarkers(
  upcoming: { scheduled_at: string | null; title: string }[],
): { markers: CalendarDayMarker[]; byDay: Map<string, { title: string; time: string }[]> } {
  const byDay = new Map<string, { title: string; time: string }[]>();
  const markerMap = new Map<string, string[]>();
  for (const session of upcoming) {
    if (!session.scheduled_at) continue;
    const at = new Date(session.scheduled_at);
    const key = format(startOfDay(at), 'yyyy-MM-dd');
    const time = format(at, 'h:mm a');
    const list = byDay.get(key) ?? [];
    list.push({ title: session.title, time });
    byDay.set(key, list);
    const times = markerMap.get(key) ?? [];
    if (!times.includes(time)) times.push(time);
    markerMap.set(key, times.sort());
  }
  return {
    markers: Array.from(markerMap.entries()).map(([dateKey, times]) => ({ dateKey, times })),
    byDay,
  };
}

/* ─── Dropdown trigger ─────────────────────────────────────────────────────── */
function DropdownTrigger({
  icon,
  label,
  value,
  open,
  onPress,
  colors,
}: {
  icon: IconName;
  label: string;
  value: string;
  open: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.trigger,
        {
          backgroundColor: open ? colors.accentSoft : colors.surface,
          borderColor: open ? colors.accent : colors.border,
        },
      ]}>
      <Icon name={icon} size={18} color={open ? colors.accent : colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.triggerLabel, { color: colors.textTertiary }]}>{label}</Text>
        <Text style={[styles.triggerValue, { color: colors.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
        <Icon name="chevronDown" size={18} color={open ? colors.accent : colors.textSecondary} />
      </View>
    </Pressable>
  );
}

/* ─── Schedule view ─────────────────────────────────────────────────────────── */
export function WatchScheduleView({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const { colors } = useTheme();
  const { schedule } = useWatchSessionMutations();
  const { data: upcoming = [] } = useUpcomingSessions();

  const [platformId, setPlatformId] = useState<StreamingPlatformId | null>(null);
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt);
  const [reminder, setReminder] = useState<number>(30);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  const closeAll = () => { setDateOpen(false); setTimeOpen(false); setReminderOpen(false); };

  const openDate = () => {
    Haptics.selectionAsync();
    setTimeOpen(false);
    setReminderOpen(false);
    setDateOpen((v) => !v);
  };

  const openTime = () => {
    Haptics.selectionAsync();
    setDateOpen(false);
    setReminderOpen(false);
    setTimeOpen((v) => !v);
  };

  const openReminder = () => {
    Haptics.selectionAsync();
    setDateOpen(false);
    setTimeOpen(false);
    setReminderOpen((v) => !v);
  };

  const minDate = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => addDays(minDate, MAX_SCHEDULE_DAYS - 1), [minDate]);
  const { markers, byDay } = useMemo(() => buildCalendarMarkers(upcoming), [upcoming]);

  const selectedDay = useMemo(() => startOfDay(scheduledAt), [scheduledAt]);
  const selectedDayKey = format(selectedDay, 'yyyy-MM-dd');
  const dayAllocations = byDay.get(selectedDayKey) ?? [];

  const h24 = scheduledAt.getHours();
  const hour12 = h24 % 12 || 12;
  const minute = scheduledAt.getMinutes();
  const ampm: 'AM' | 'PM' = h24 < 12 ? 'AM' : 'PM';
  const disableTimesBefore = isSameDay(scheduledAt, new Date()) ? new Date() : undefined;

  const isPast = scheduledAt.getTime() <= Date.now();
  const resolvedTitle = title.trim() || (platformId ? getStreamingPlatform(platformId).name : '');
  const reminderLabel = WATCH_REMINDER_OPTIONS.find((r) => r.minutes === reminder)?.label ?? '';

  const handleSchedule = () => {
    if (!resolvedTitle) {
      Alert.alert('Add a title', 'Name what you want to watch or pick a service.');
      return;
    }
    if (isPast) {
      Alert.alert('Pick a future time', 'Choose a date and time that is still ahead.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    schedule.mutate(
      { title: resolvedTitle, platformId: platformId ?? undefined, scheduledAt: scheduledAt.toISOString(), reminderMinutes: reminder },
      {
        onSuccess: () => {
          Alert.alert('Date night set 🍿', `${resolvedTitle} on ${format(scheduledAt, 'EEE MMM d, h:mm a')}.`);
          onBack();
        },
        onError: () => Alert.alert('Could not schedule', 'Please try again.'),
      },
    );
  };

  return (
    <WatchScreen title="Schedule date night" onClose={onClose} onBack={onBack} contentStyle={{ gap: 0 }}>
      {/* Outer pressable closes any open dropdown when tapping outside */}
      <Pressable onPress={closeAll} style={styles.contentWrapper}>

      {/* ── WHAT ── */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WHAT TO WATCH</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Interstellar"
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
      />

      {/* ── WHERE ── */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WHERE</Text>
      <PlatformConnectGrid selectedPlatformId={platformId} onSelectPlatform={setPlatformId} compact />

      {/* ── DATE ── */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DATE</Text>
      <DropdownTrigger
        icon="calendar"
        label="Selected date"
        value={format(scheduledAt, 'EEEE, MMMM d, yyyy')}
        open={dateOpen}
        onPress={openDate}
        colors={colors}
      />
      {dateOpen && (
        <View
          style={[styles.dropdownPanel, { backgroundColor: colors.surface, borderColor: colors.accent }]}
          onStartShouldSetResponder={() => true}>

          <MonthCalendarPicker
            value={selectedDay}
            selectedDateTime={scheduledAt}
            minDate={minDate}
            maxDate={maxDate}
            markers={markers}
            onChange={(day) => {
              setScheduledAt((prev) => applyDay(prev, day));
            }}
          />
          {dayAllocations.length > 0 && (
            <View style={[styles.allocationBox, { borderTopColor: colors.border }]}>
              <Text style={[styles.allocationTitle, { color: colors.textSecondary }]}>Already booked this day</Text>
              {dayAllocations.map((a, i) => (
                <View key={`${a.title}-${i}`} style={styles.allocationRow}>
                  <Icon name="film" size={13} color={colors.accent} />
                  <Text style={{ color: colors.text, flex: 1, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{a.title}</Text>
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{a.time}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── TIME ── */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TIME</Text>
      <DropdownTrigger
        icon="moon"
        label="Selected time"
        value={format(scheduledAt, 'h:mm a')}
        open={timeOpen}
        onPress={openTime}
        colors={colors}
      />
      {timeOpen && (
        <View
          style={[styles.dropdownPanel, { backgroundColor: colors.surface, borderColor: colors.accent }]}
          onStartShouldSetResponder={() => true}>
          <TimePickerDropdown
            hour12={hour12}
            minute={minute}
            period={ampm}
            disabledBefore={disableTimesBefore}
            onChange={(h, m, p) => setScheduledAt((prev) => applyTimeParts(prev, h, m, p))}
          />
        </View>
      )}

      {/* ── REMINDER ── */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>REMINDER</Text>
      <DropdownTrigger
        icon="bell"
        label="Remind us"
        value={reminderLabel}
        open={reminderOpen}
        onPress={openReminder}
        colors={colors}
      />
      {reminderOpen && (
        <View
          style={[styles.dropdownPanel, { backgroundColor: colors.surface, borderColor: colors.accent }]}
          onStartShouldSetResponder={() => true}>
          {WATCH_REMINDER_OPTIONS.map((r) => {
            const active = reminder === r.minutes;
            return (
              <Pressable
                key={r.minutes}
                onPress={() => { Haptics.selectionAsync(); setReminder(r.minutes); setReminderOpen(false); }}
                style={[
                  styles.reminderOption,
                  {
                    backgroundColor: active ? colors.accentSoft : 'transparent',
                    borderRadius: 10,
                  },
                ]}>
                <Text style={[styles.reminderOptionText, { color: active ? colors.accent : colors.text }]}>
                  {r.label}
                </Text>
                {active && <Icon name="check" size={16} color={colors.accent} />}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* ── SUMMARY ── */}
      <View style={[styles.summary, { backgroundColor: colors.surfaceElevated, borderColor: isPast ? colors.error : colors.border }]}>
        <View style={[styles.summaryAccent, { backgroundColor: isPast ? colors.error : colors.accent }]} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.summaryDate, { color: colors.text }]}>
            {format(scheduledAt, "EEE, MMMM d 'at' h:mm a")}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Reminder · {reminderLabel}
          </Text>
        </View>
        {isPast && <Text style={{ color: colors.error, fontSize: 12, fontWeight: '800' }}>Past</Text>}
      </View>

      <PrimaryButton label="Schedule date night" onPress={handleSchedule} loading={schedule.isPending} />
      </Pressable>
    </WatchScreen>
  );
}

const PANEL_RADIUS = 16;

const styles = StyleSheet.create({
  contentWrapper: { gap: 18 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  input: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },

  /* ── Dropdown trigger ── */
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  triggerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 1 },
  triggerValue: { fontSize: 15, fontWeight: '700' },

  /* ── Dropdown panel ── */
  dropdownPanel: {
    borderRadius: PANEL_RADIUS,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginTop: -6,
  },

  /* ── Allocations ── */
  allocationBox: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  allocationTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  allocationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  /* ── Reminder options ── */
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  reminderOptionText: { fontSize: 15, fontWeight: '600' },

  /* ── Summary ── */
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 14,
  },
  summaryAccent: { width: 4, alignSelf: 'stretch' },
  summaryDate: { fontSize: 15, fontWeight: '800' },
});
