import { format, isToday, startOfDay } from 'date-fns';
import { paperEdge } from '@/components/ui/primitives';
import * as Haptics from '@/lib/haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlanWheelColumn, useTimeWheelItems } from '@/components/calendar/plan/PlanWheelColumn';
import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { Icon } from '@/components/ui/Icon';
import { MonthCalendarPicker } from '@/components/ui/MonthCalendarPicker';
import { useTheme } from '@/hooks/useTheme';

/**
 * Plans can't start in the past: a time that's already gone moves to the next
 * quarter hour from now (a day in the future is left as it is).
 */
/** Whether h:m today is already over (read from the clock outside render). */
function timeHasPassedToday(h24: number, minute: number): boolean {
  const at = new Date();
  at.setHours(h24, minute, 0, 0);
  return at.getTime() <= Date.now();
}

export function notInPast(when: Date): Date {
  const now = new Date();
  if (when.getTime() > now.getTime()) return when;
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(Math.ceil((now.getMinutes() + 1) / 15) * 15);
  return next;
}

function ModalHeader({
  title,
  onClose,
  onDone,
  doneDisabled,
}: {
  title: string;
  onClose: () => void;
  onDone: () => void;
  doneDisabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onClose}
        hitSlop={8}
        accessibilityLabel="Close"
        style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }, paperEdge(colors)]}>
        <Icon name="close" size={18} color={colors.textSecondary} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      <Pressable
        onPress={onDone}
        disabled={doneDisabled}
        hitSlop={8}
        accessibilityLabel="Done"
        accessibilityState={{ disabled: !!doneDisabled }}
        style={[styles.iconBtn, { backgroundColor: colors.accentSoft, opacity: doneDisabled ? 0.4 : 1 }]}>
        <Icon name="check" size={18} color={colors.accent} />
      </Pressable>
    </View>
  );
}

export function PlanDateModal({
  visible,
  value,
  onClose,
  onConfirm,
  allowPast = false,
}: {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onConfirm: (day: Date) => void;
  /** Plans can't be set in the past; pass true for things that already happened. */
  allowPast?: boolean;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(value);
  // Each time it opens, start from the current value (while rendering).
  const openKey = visible ? value.getTime() : null;
  const [lastOpenKey, setLastOpenKey] = useState<number | null>(null);
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (visible) setDraft(value);
  }

  return (
    <DraggableSheet visible={visible} onClose={onClose} style={styles.sheet}>
      <ModalHeader
        title="Date"
        onClose={onClose}
        onDone={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onConfirm(draft);
        }}
      />
      <Text style={[styles.preview, { color: colors.text }]}>{format(draft, 'EEEE, MMM d')}</Text>
      <View style={styles.pickerPad}>
        <MonthCalendarPicker value={draft} onChange={setDraft} minDate={allowPast ? null : startOfDay(new Date())} />
      </View>
    </DraggableSheet>
  );
}

export function PlanTimeModal({
  visible,
  hour12,
  minute,
  period,
  onClose,
  onConfirm,
  day,
}: {
  visible: boolean;
  hour12: number;
  minute: number;
  period: 'AM' | 'PM';
  onClose: () => void;
  onConfirm: (h: number, m: number, p: 'AM' | 'PM') => void;
  /** The plan's day: when it's today, times that have already passed can't be chosen. */
  day?: Date;
}) {
  const { colors } = useTheme();
  const { hours, minutes, periods } = useTimeWheelItems();
  const [h, setH] = useState(hour12);
  const [m, setM] = useState(minute);
  const [p, setP] = useState<'AM' | 'PM'>(period);

  // Each time it opens, start from the current time value (while rendering).
  const openKey = visible ? `${hour12}:${minute}${period}` : null;
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (visible) {
      setH(hour12);
      setM(minute);
      setP(period);
    }
  }

  const h24 = p === 'PM' ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h;
  const passed = !!day && isToday(day) && timeHasPassedToday(h24, m);

  return (
    <DraggableSheet visible={visible} onClose={onClose} style={styles.sheet}>
      <ModalHeader
        title="Time"
        onClose={onClose}
        doneDisabled={passed}
        onDone={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onConfirm(h, m, p);
        }}
      />

      <Text style={[styles.preview, { color: passed ? colors.textTertiary : colors.text }]}>
        {`${h}:${String(m).padStart(2, '0')} ${p}`}
      </Text>
      {passed ? (
        <Text style={[styles.passed, { color: colors.error }]}>That time has already passed today</Text>
      ) : null}

      <View style={styles.wheels}>
        <PlanWheelColumn items={hours} value={h} onChange={(v) => setH(Number(v))} width={88} />
        <Text style={[styles.colon, { color: colors.textTertiary }]}>:</Text>
        <PlanWheelColumn items={minutes} value={m} onChange={(v) => setM(Number(v))} width={88} />
        <PlanWheelColumn items={periods} value={p} onChange={(v) => setP(v as 'AM' | 'PM')} width={72} />
      </View>
    </DraggableSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 0,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  passed: { textAlign: 'center', fontSize: 13, fontWeight: '700', marginTop: -6, marginBottom: 6 },
  preview: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },
  pickerPad: { paddingHorizontal: 16, paddingBottom: 8 },
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 4,
  },
  colon: { fontSize: 24, fontWeight: '700', marginBottom: 2 },
});
