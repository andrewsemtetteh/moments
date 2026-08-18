import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AnniversaryDatePicker } from '@/components/onboarding/AnniversaryDatePicker';
import { DraggableSheet } from '@/components/ui/DraggableSheet';
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
    <DraggableSheet visible={visible} onClose={onClose} style={styles.sheet}>
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
    </DraggableSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
  },
  saveBtn: { marginTop: 20 },
  cancel: { alignItems: 'center', marginTop: 14 },
});
