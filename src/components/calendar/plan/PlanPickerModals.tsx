import { format, isToday, startOfDay } from 'date-fns';
import { insetCardStyle } from '@/components/ui/primitives';
import * as Haptics from '@/lib/haptics';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PlanWheelColumn, useTimeWheelItems } from '@/components/calendar/plan/PlanWheelColumn';
import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { SheetHeader, SheetIconButton } from '@/components/ui/SheetHeader';
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

/** A day before today becomes today (plans can't be on a day that's gone). */
function notBeforeToday(day: Date): Date {
  const today = startOfDay(new Date());
  return day.getTime() < today.getTime() ? today : day;
}

type TimeParts = { h: number; m: number; p: 'AM' | 'PM' };

/**
 * On today, a time that's already gone moves up to the next quarter hour from now (so the
 * wheels can't rest on the past); other days are left as they are.
 */
function upcomingTime(parts: TimeParts, day: Date | undefined): TimeParts {
  if (!day || !isToday(day)) return parts;
  const h24 = parts.p === 'PM' ? (parts.h === 12 ? 12 : parts.h + 12) : parts.h === 12 ? 0 : parts.h;
  if (!timeHasPassedToday(h24, parts.m)) return parts;
  const next = notInPast(new Date());
  // Past 11:45 PM there's no later time today: keep the last one.
  if (!isToday(next)) return { h: 11, m: 59, p: 'PM' };
  const nh = next.getHours();
  return { h: nh % 12 || 12, m: next.getMinutes(), p: nh < 12 ? 'AM' : 'PM' };
}

/** The Settings drawer top: the title on the left, ✕ and a filled ✓ on the right. */
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
  return (
    <View style={styles.header}>
      <SheetHeader
        title={title}
        onClose={onClose}
        right={<SheetIconButton icon="check" primary onPress={onDone} disabled={doneDisabled} accessibilityLabel="Done" />}
      />
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
    // Opens on the plan's day, or today if that's already gone.
    if (visible) setDraft(allowPast ? value : notBeforeToday(value));
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
      <View style={[styles.pickerCard, insetCardStyle(colors, 'sheet')]}>
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
      // Opens on the plan's time, or the next free quarter hour if that's already gone.
      const start = upcomingTime({ h: hour12, m: minute, p: period }, day);
      setH(start.h);
      setM(start.m);
      setP(start.p);
    }
  }

  /** A wheel moved: past times on today snap forward, so the past can't be picked. */
  const pick = (next: TimeParts) => {
    const t = upcomingTime(next, day);
    setH(t.h);
    setM(t.m);
    setP(t.p);
  };

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

      <View style={[styles.wheels, styles.pickerCard, insetCardStyle(colors, 'sheet')]}>
        <PlanWheelColumn items={hours} value={h} onChange={(v) => pick({ h: Number(v), m, p })} width={88} />
        <Text style={[styles.colon, { color: colors.textTertiary }]}>:</Text>
        <PlanWheelColumn items={minutes} value={m} onChange={(v) => pick({ h, m: Number(v), p })} width={88} />
        <PlanWheelColumn items={periods} value={p} onChange={(v) => pick({ h, m, p: v as 'AM' | 'PM' })} width={72} />
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
  header: { paddingHorizontal: 16, paddingTop: 4 },
  passed: { textAlign: 'center', fontSize: 13, fontWeight: '700', marginTop: -6, marginBottom: 6 },
  preview: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },
  pickerCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 18, overflow: 'hidden', padding: 8 },
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
