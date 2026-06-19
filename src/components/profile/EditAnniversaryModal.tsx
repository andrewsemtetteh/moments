import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primitives';
import { formatAnniversaryDisplay, formatAnniversaryForDb, parseAnniversaryDate } from '@/lib/anniversary';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  visible: boolean;
  value: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (isoDate: string) => void;
};

export function EditAnniversaryModal({ visible, value, saving = false, onClose, onSave }: Props) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(() => parseAnniversaryDate(value));
  const [showAndroidPicker, setShowAndroidPicker] = useState(Platform.OS === 'android');

  useEffect(() => {
    if (visible) {
      setDraft(parseAnniversaryDate(value));
      setShowAndroidPicker(Platform.OS === 'android');
    }
  }, [visible, value]);

  const onChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowAndroidPicker(false);
      if (date) setDraft(date);
      return;
    }
    if (date) setDraft(date);
  };

  const save = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(formatAnniversaryForDb(draft));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]} onPress={() => undefined}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>Anniversary date</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            When you got together — used for your countdown and how long you&apos;ve been a couple.
          </Text>

          <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Selected date</Text>
            <Text style={[styles.previewValue, { color: colors.text }]}>{formatAnniversaryDisplay(draft)}</Text>
          </View>

          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={draft}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={onChange}
              themeVariant={colors.isDark ? 'dark' : 'light'}
              style={styles.picker}
            />
          ) : showAndroidPicker ? (
            <DateTimePicker
              value={draft}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={onChange}
            />
          ) : (
            <Pressable
              onPress={() => setShowAndroidPicker(true)}
              style={[styles.androidPickBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Change date</Text>
            </Pressable>
          )}

          <PrimaryButton label={saving ? 'Saving…' : 'Save anniversary'} onPress={save} loading={saving} style={styles.saveBtn} />
          <Pressable onPress={onClose} style={styles.cancel} hitSlop={8}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  label: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
    gap: 4,
  },
  previewLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  previewValue: { fontSize: 18, fontWeight: '800' },
  picker: { height: 180, marginBottom: 8 },
  androidPickBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveBtn: { marginTop: 8 },
  cancel: { alignItems: 'center', marginTop: 14 },
});
