import { addDays, format, nextSaturday, setHours, setMinutes, setSeconds } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PlatformConnectGrid } from '@/components/watch/PlatformConnectGrid';
import { WatchScreen } from '@/components/watch/WatchScreen';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import type { StreamingPlatformId } from '@/constants/streaming-platforms';
import { getStreamingPlatform } from '@/constants/streaming-platforms';
import { WATCH_REMINDER_OPTIONS } from '@/constants/watch-together';
import { useWatchSessionMutations } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';

type DayKey = 'today' | 'tomorrow' | 'weekend';

const DAY_OPTIONS: { key: DayKey; label: string }[] = [
  { key: 'today', label: 'Tonight' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'This weekend' },
];

const TIME_OPTIONS = [18, 19, 20, 21, 22];

function resolveDate(day: DayKey, hour: number): Date {
  const base =
    day === 'today' ? new Date() : day === 'tomorrow' ? addDays(new Date(), 1) : nextSaturday(new Date());
  return setSeconds(setMinutes(setHours(base, hour), 0), 0);
}

export function WatchScheduleView({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const { colors } = useTheme();
  const { schedule } = useWatchSessionMutations();

  const [platformId, setPlatformId] = useState<StreamingPlatformId | null>(null);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState<DayKey>('today');
  const [hour, setHour] = useState(20);
  const [reminder, setReminder] = useState<number>(60);

  const scheduledDate = resolveDate(day, hour);
  const isPast = scheduledDate.getTime() <= Date.now();
  const resolvedTitle = title.trim() || (platformId ? getStreamingPlatform(platformId).name : '');

  const handleSchedule = () => {
    if (!resolvedTitle) {
      Alert.alert('Add a title', 'Name what you want to watch or pick a service.');
      return;
    }
    if (isPast) {
      Alert.alert('Pick a future time', 'That time has already passed today — try a later slot.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    schedule.mutate(
      {
        title: resolvedTitle,
        platformId: platformId ?? undefined,
        scheduledAt: scheduledDate.toISOString(),
        reminderMinutes: reminder,
      },
      {
        onSuccess: () => {
          Alert.alert('Date night set 🍿', `${resolvedTitle} on ${format(scheduledDate, 'EEE MMM d, h:mm a')}.`);
          onBack();
        },
        onError: () => Alert.alert('Could not schedule', 'Please try again.'),
      },
    );
  };

  return (
    <WatchScreen title="Schedule date night" onClose={onClose} onBack={onBack}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>WHAT TO WATCH</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Interstellar"
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>WHERE</Text>
      <PlatformConnectGrid selectedPlatformId={platformId} onSelectPlatform={setPlatformId} compact />

      <Text style={[styles.label, { color: colors.textSecondary }]}>DAY</Text>
      <View style={styles.chipRow}>
        {DAY_OPTIONS.map((d) => (
          <SelectChip key={d.key} label={d.label} active={day === d.key} onPress={() => setDay(d.key)} colors={colors} />
        ))}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>TIME</Text>
      <View style={styles.chipRow}>
        {TIME_OPTIONS.map((h) => (
          <SelectChip
            key={h}
            label={format(setHours(new Date(), h), 'h a')}
            active={hour === h}
            onPress={() => setHour(h)}
            colors={colors}
          />
        ))}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>REMIND US</Text>
      <View style={styles.chipRow}>
        {WATCH_REMINDER_OPTIONS.map((r) => (
          <SelectChip
            key={r.minutes}
            label={r.label}
            active={reminder === r.minutes}
            onPress={() => setReminder(r.minutes)}
            colors={colors}
          />
        ))}
      </View>

      <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Icon name="calendar" size={18} color={colors.accent} />
        <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>
          {format(scheduledDate, 'EEE MMM d, h:mm a')}
        </Text>
        {isPast && <Text style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>Past</Text>}
      </View>

      <PrimaryButton label="Schedule date night" onPress={handleSchedule} loading={schedule.isPending} />
    </WatchScreen>
  );
}

function SelectChip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.accent : colors.surfaceElevated,
          borderColor: active ? colors.accent : colors.border,
        },
      ]}>
      <Text style={{ color: active ? colors.onAccent : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 4 },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
