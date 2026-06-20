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

import { Icon, type IconName } from '@/components/ui/Icon';
import { MonthCalendarPicker, type CalendarDayMarker } from '@/components/ui/MonthCalendarPicker';
import { PrimaryButton } from '@/components/ui/primitives';
import { TimePickerDropdown } from '@/components/ui/TimePickerDropdown';
import { PlatformConnectGrid } from '@/components/watch/PlatformConnectGrid';
import { WatchPageHero, watchPanelStyles } from '@/components/watch/WatchPageHero';
import { WatchScreen } from '@/components/watch/WatchScreen';
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
      <View style={[styles.triggerIcon, { backgroundColor: open ? colors.accent : colors.surfaceElevated }]}>
        <Icon name={icon} size={16} color={open ? colors.onAccent : colors.textSecondary} filled={open} />
      </View>
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

  const closeAll = () => {
    setDateOpen(false);
    setTimeOpen(false);
    setReminderOpen(false);
  };

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
      {
        title: resolvedTitle,
        platformId: platformId ?? undefined,
        scheduledAt: scheduledAt.toISOString(),
        reminderMinutes: reminder,
      },
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
    <WatchScreen title="Schedule date night" onClose={onClose} onBack={onBack}>
      <WatchPageHero
        eyebrow="PLAN AHEAD"
        title="Schedule date night"
        subtitle="Pick what, where, and when — we'll remind you both before it starts."
        icon="calendar"
      />

      <Pressable onPress={closeAll} style={styles.form}>
        {/* What + where */}
        <View
          style={[
            watchPanelStyles.panel,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginTop: -18 },
          ]}>
          <View style={watchPanelStyles.fieldGroup}>
            <Text style={[watchPanelStyles.sectionLabel, { color: colors.textSecondary }]}>
              What to watch
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Movie, show, or episode"
              placeholderTextColor={colors.textTertiary}
              style={[
                watchPanelStyles.fieldInput,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            />
          </View>

          <View style={watchPanelStyles.fieldGroup}>
            <Text style={[watchPanelStyles.sectionLabel, { color: colors.textSecondary }]}>
              Streaming service
            </Text>
            <PlatformConnectGrid
              selectedPlatformId={platformId}
              onSelectPlatform={setPlatformId}
              compact
              hideHeader
              mode="pick"
            />
          </View>
        </View>

        {/* When */}
        <View
          style={[
            watchPanelStyles.panel,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 16, gap: 10 },
          ]}>
          <Text style={[watchPanelStyles.sectionLabel, { color: colors.textSecondary }]}>When</Text>

          <DropdownTrigger
            icon="calendar"
            label="Date"
            value={format(scheduledAt, 'EEEE, MMM d')}
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
                onChange={(day) => setScheduledAt((prev) => applyDay(prev, day))}
              />
              {dayAllocations.length > 0 && (
                <View style={[styles.allocationBox, { borderTopColor: colors.border }]}>
                  <Text style={[styles.allocationTitle, { color: colors.textSecondary }]}>
                    Already booked this day
                  </Text>
                  {dayAllocations.map((a, i) => (
                    <View key={`${a.title}-${i}`} style={styles.allocationRow}>
                      <Icon name="film" size={13} color={colors.accent} />
                      <Text
                        style={{ color: colors.text, flex: 1, fontWeight: '600', fontSize: 13 }}
                        numberOfLines={1}>
                        {a.title}
                      </Text>
                      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{a.time}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <DropdownTrigger
            icon="moon"
            label="Time"
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

          <DropdownTrigger
            icon="bell"
            label="Reminder"
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
                    onPress={() => {
                      Haptics.selectionAsync();
                      setReminder(r.minutes);
                      setReminderOpen(false);
                    }}
                    style={[
                      styles.reminderOption,
                      { backgroundColor: active ? colors.accentSoft : 'transparent', borderRadius: 10 },
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
        </View>

        {/* Summary */}
        <View
          style={[
            styles.summary,
            {
              backgroundColor: colors.surface,
              borderColor: isPast ? colors.error : colors.border,
            },
          ]}>
          <View
            style={[
              styles.summaryStripe,
              { backgroundColor: isPast ? colors.error : colors.accent },
            ]}
          />
          <View style={styles.summaryCopy}>
            <Text style={[styles.summaryTitle, { color: colors.text }]} numberOfLines={1}>
              {resolvedTitle || 'Pick a title or service'}
            </Text>
            <Text style={[styles.summaryDate, { color: isPast ? colors.error : colors.textSecondary }]}>
              {format(scheduledAt, "EEE, MMM d 'at' h:mm a")}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
              Reminder · {reminderLabel}
              {platformId ? ` · ${getStreamingPlatform(platformId).name}` : ''}
            </Text>
          </View>
          {isPast && (
            <View style={[styles.pastBadge, { backgroundColor: colors.error }]}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Past</Text>
            </View>
          )}
        </View>

        <PrimaryButton label="Schedule date night" onPress={handleSchedule} loading={schedule.isPending} />
      </Pressable>
    </WatchScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  triggerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  triggerValue: { fontSize: 15, fontWeight: '700', marginTop: 1 },
  dropdownPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginTop: -4,
  },
  allocationBox: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  allocationTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  allocationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  reminderOptionText: { fontSize: 15, fontWeight: '600' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    gap: 14,
    paddingRight: 14,
  },
  summaryStripe: { width: 4, alignSelf: 'stretch' },
  summaryCopy: { flex: 1, gap: 3, paddingVertical: 14 },
  summaryTitle: { fontSize: 16, fontWeight: '800' },
  summaryDate: { fontSize: 14, fontWeight: '600' },
  pastBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
