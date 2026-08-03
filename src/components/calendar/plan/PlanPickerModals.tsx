import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlanWheelColumn, useTimeWheelItems } from '@/components/calendar/plan/PlanWheelColumn';
import { Icon } from '@/components/ui/Icon';
import { MonthCalendarPicker } from '@/components/ui/MonthCalendarPicker';
import { useTheme } from '@/hooks/useTheme';

function ModalHeader({
  title,
  onClose,
  onDone,
}: {
  title: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onClose}
        hitSlop={8}
        accessibilityLabel="Close"
        style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}>
        <Icon name="close" size={18} color={colors.textSecondary} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      <Pressable
        onPress={onDone}
        hitSlop={8}
        accessibilityLabel="Done"
        style={[styles.iconBtn, { backgroundColor: colors.accentSoft }]}>
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
}: {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onConfirm: (day: Date) => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}>
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
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
            <MonthCalendarPicker value={draft} onChange={setDraft} minDate={null} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function PlanTimeModal({
  visible,
  hour12,
  minute,
  period,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  hour12: number;
  minute: number;
  period: 'AM' | 'PM';
  onClose: () => void;
  onConfirm: (h: number, m: number, p: 'AM' | 'PM') => void;
}) {
  const { colors } = useTheme();
  const { hours, minutes, periods } = useTimeWheelItems();
  const [h, setH] = useState(hour12);
  const [m, setM] = useState(minute);
  const [p, setP] = useState<'AM' | 'PM'>(period);

  useEffect(() => {
    if (!visible) return;
    setH(hour12);
    setM(minute);
    setP(period);
  }, [visible, hour12, minute, period]);

  const previewDate = new Date();
  const h24 = p === 'PM' ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h;
  previewDate.setHours(h24, m, 0, 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}>
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          <ModalHeader
            title="Time"
            onClose={onClose}
            onDone={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onConfirm(h, m, p);
            }}
          />

          <Text style={[styles.preview, { color: colors.text }]}>{format(previewDate, 'h:mm a')}</Text>

          <View style={styles.wheels}>
            <PlanWheelColumn items={hours} value={h} onChange={(v) => setH(Number(v))} width={88} />
            <Text style={[styles.colon, { color: colors.textTertiary }]}>:</Text>
            <PlanWheelColumn items={minutes} value={m} onChange={(v) => setM(Number(v))} width={88} />
            <PlanWheelColumn
              items={periods}
              value={p}
              onChange={(v) => setP(v as 'AM' | 'PM')}
              width={72}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
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
