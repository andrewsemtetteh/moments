import { format, setHours, setMinutes } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
/** 5-minute steps — cleaner than scrolling 60 cells inside a sheet. */
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const PERIODS = ['AM', 'PM'] as const;

function formatPreview(h: number, m: number, p: 'AM' | 'PM') {
  const sample = new Date();
  const h24 = p === 'PM' ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h;
  sample.setHours(h24, m, 0, 0);
  return format(sample, 'h:mm a');
}

function isSlotPast(h12: number, m: number, p: 'AM' | 'PM', disabledBefore?: Date) {
  if (!disabledBefore) return false;
  const h24 = p === 'PM' ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
  const slot = setMinutes(setHours(disabledBefore, h24), m);
  return slot.getTime() <= disabledBefore.getTime();
}

function snapMinute(m: number) {
  return Math.round(m / 5) * 5 % 60;
}

export function TimePickerDropdown({
  hour12,
  minute,
  period,
  onChange,
  disabledBefore,
}: {
  hour12: number;
  minute: number;
  period: 'AM' | 'PM';
  onChange: (h: number, m: number, p: 'AM' | 'PM') => void;
  disabledBefore?: Date;
}) {
  const { colors } = useTheme();
  const minuteSnapped = snapMinute(minute);
  const preview = formatPreview(hour12, minuteSnapped, period);

  const selectHour = (h: number) => {
    if (isSlotPast(h, minuteSnapped, period, disabledBefore)) return;
    Haptics.selectionAsync();
    onChange(h, minuteSnapped, period);
  };

  const selectMinute = (m: number) => {
    if (isSlotPast(hour12, m, period, disabledBefore)) return;
    Haptics.selectionAsync();
    onChange(hour12, m, period);
  };

  const selectPeriod = (p: 'AM' | 'PM') => {
    if (isSlotPast(hour12, minuteSnapped, p, disabledBefore)) return;
    Haptics.selectionAsync();
    onChange(hour12, minuteSnapped, p);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.preview, { color: colors.text }]}>{preview}</Text>

      <Text style={[styles.label, { color: colors.textTertiary }]}>Hour</Text>
      <View style={styles.rowWrap}>
        {HOURS.map((h) => {
          const selected = h === hour12;
          const disabled = isSlotPast(h, minuteSnapped, period, disabledBefore);
          return (
            <Pressable
              key={h}
              onPress={() => selectHour(h)}
              disabled={disabled}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.accent : colors.surfaceElevated,
                  opacity: disabled ? 0.35 : 1,
                },
              ]}>
              <Text style={[styles.chipText, { color: selected ? colors.onAccent : colors.text }]}>{h}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.textTertiary }]}>Minute</Text>
      <View style={styles.rowWrap}>
        {MINUTES.map((m) => {
          const selected = m === minuteSnapped;
          const disabled = isSlotPast(hour12, m, period, disabledBefore);
          const label = m < 10 ? `0${m}` : String(m);
          return (
            <Pressable
              key={m}
              onPress={() => selectMinute(m)}
              disabled={disabled}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.accent : colors.surfaceElevated,
                  opacity: disabled ? 0.35 : 1,
                },
              ]}>
              <Text style={[styles.chipText, { color: selected ? colors.onAccent : colors.text }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.periodRow}>
        {PERIODS.map((p) => {
          const selected = p === period;
          const disabled = isSlotPast(hour12, minuteSnapped, p, disabledBefore);
          return (
            <Pressable
              key={p}
              onPress={() => selectPeriod(p)}
              disabled={disabled}
              style={[
                styles.periodBtn,
                {
                  backgroundColor: selected ? colors.accent : colors.surfaceElevated,
                  opacity: disabled ? 0.35 : 1,
                },
              ]}>
              <Text style={{ color: selected ? colors.onAccent : colors.text, fontWeight: '700', fontSize: 15 }}>
                {p}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  preview: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    width: 44,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  periodRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  periodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
});
