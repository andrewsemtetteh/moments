import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AnniversaryDatePicker } from '@/components/onboarding/AnniversaryDatePicker';
import { PrimaryButton } from '@/components/ui/primitives';
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
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const save = () => {
    onSave(draft);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View
          style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}
          onStartShouldSetResponder={() => true}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <AnniversaryDatePicker
            value={draft}
            onChange={setDraft}
            subtitle="We use this for your anniversary countdown and how long you've been together."
            surfaceColor={colors.backgroundElevated}
          />

          <PrimaryButton
            label={saving ? 'Saving…' : 'Save anniversary'}
            onPress={save}
            loading={saving}
            style={styles.saveBtn}
          />
          <Pressable onPress={onClose} style={styles.cancel} hitSlop={8}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
  saveBtn: { marginTop: 20 },
  cancel: { alignItems: 'center', marginTop: 14 },
});
