import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

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
        surfaceColor={colors.surfaceElevated}
      />

      <PrimaryButton
        label={saving ? 'Saving…' : 'Save anniversary'}
        onPress={save}
        loading={saving}
        style={styles.saveBtn}
      />
    </DraggableSheet>
  );
}

const styles = StyleSheet.create({
  // Close by dragging the handle down or tapping outside (the date wheel
  // needs the vertical drags, so it isn't drag-anywhere).
  sheet: { paddingTop: 4 },
  saveBtn: { marginTop: 20 },
});
