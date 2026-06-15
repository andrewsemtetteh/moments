import { format, setHours, setMinutes } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
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
  const preview = formatPreview(hour12, minute, period);

  const selectHour = (h: number) => {
    if (isSlotPast(h, minute, period, disabledBefore)) return;
    Haptics.selectionAsync();
    onChange(h, minute, period);
  };

  const selectMinute = (m: number) => {
    if (isSlotPast(hour12, m, period, disabledBefore)) return;
    Haptics.selectionAsync();
    onChange(hour12, m, period);
  };

  const selectPeriod = (p: 'AM' | 'PM') => {
    if (isSlotPast(hour12, minute, p, disabledBefore)) return;
    Haptics.selectionAsync();
    onChange(hour12, minute, p);
  };

  return (
    <View>
      <View style={[styles.previewCard, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
        <Text style={[styles.previewTime, { color: colors.text }]}>{preview}</Text>
        <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>Selected time</Text>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>HOUR</Text>
      <View style={styles.grid}>
        {HOURS.map((h) => {
          const selected = h === hour12;
          const disabled = isSlotPast(h, minute, period, disabledBefore);
          return (
            <Pressable key={h} onPress={() => selectHour(h)} disabled={disabled} style={styles.cell}>
              <View
                style={[
                  styles.cellInner,
                  selected && { backgroundColor: colors.accent },
                  !selected && { backgroundColor: colors.surfaceElevated },
                  disabled && { opacity: 0.3 },
                ]}>
                <Text style={[styles.cellText, { color: selected ? colors.onAccent : colors.text }]}>{h}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>MINUTE</Text>
      <ScrollView style={styles.minuteScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        <View style={styles.minuteGrid}>
          {MINUTES.map((m) => {
            const selected = m === minute;
            const disabled = isSlotPast(hour12, m, period, disabledBefore);
            const label = m < 10 ? `0${m}` : String(m);
            return (
              <Pressable key={m} onPress={() => selectMinute(m)} disabled={disabled} style={styles.minuteCell}>
                <View
                  style={[
                    styles.minuteInner,
                    selected && { backgroundColor: colors.accent },
                    !selected && { backgroundColor: colors.surfaceElevated },
                    disabled && { opacity: 0.3 },
                  ]}>
                  <Text style={[styles.minuteText, { color: selected ? colors.onAccent : colors.text }]}>{label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>AM / PM</Text>
      <View style={styles.periodRow}>
        {PERIODS.map((p) => {
          const selected = p === period;
          const disabled = isSlotPast(hour12, minute, p, disabledBefore);
          return (
            <Pressable
              key={p}
              onPress={() => selectPeriod(p)}
              disabled={disabled}
              style={[
                styles.periodBtn,
                {
                  backgroundColor: selected ? colors.accent : colors.surfaceElevated,
                  borderColor: selected ? colors.accent : colors.border,
                  opacity: disabled ? 0.3 : 1,
                },
              ]}>
              <Text style={{ color: selected ? colors.onAccent : colors.text, fontWeight: '800', fontSize: 16 }}>{p}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  previewTime: { fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'] },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  cell: { width: `${100 / 4}%`, alignItems: 'center', paddingVertical: 4 },
  cellInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontSize: 16, fontWeight: '800' },
  minuteScroll: { maxHeight: 140 },
  minuteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
  minuteCell: { width: `${100 / 6}%`, alignItems: 'center', paddingVertical: 3 },
  minuteInner: {
    width: 42,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minuteText: { fontSize: 13, fontWeight: '700' },
  periodRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  periodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
