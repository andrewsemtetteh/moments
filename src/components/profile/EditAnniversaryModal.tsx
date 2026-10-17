import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnniversaryWheelPicker } from '@/components/onboarding/AnniversaryWheelPicker';
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

/** Same layout as the other Settings sheets (relationship type etc.): title, hint, the control, then Save. */
export function EditAnniversaryModal({ visible, value, saving = false, onClose, onSave }: Props) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(value);

  // Each time it opens, start from the saved date (while rendering).
  const openKey = visible ? value : null;
  const [lastOpenKey, setLastOpenKey] = useState<typeof value | null>(null);
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (visible) setDraft(value);
  }

  return (
    <DraggableSheet visible={visible} onClose={onClose}>
      <Text style={[styles.title, { color: colors.text }]}>Anniversary</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Used for your countdown and how long you’ve been together.
      </Text>

      <View
        style={[
          styles.picker,
          { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: colors.boldBorder ? 2 : 0 },
        ]}>
        <AnniversaryWheelPicker value={draft} onChange={setDraft} surfaceColor={colors.surface} />
      </View>

      <PrimaryButton
        label={saving ? 'Saving…' : 'Save'}
        onPress={() => onSave(draft)}
        loading={saving}
        style={styles.saveBtn}
      />
    </DraggableSheet>
  );
}

// Closes by dragging the handle down or tapping outside (the date wheel needs
// vertical drags, so unlike the choice sheets it isn't drag-anywhere).
const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  hint: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  picker: { marginTop: 16, borderRadius: 18, overflow: 'hidden', paddingVertical: 8 },
  saveBtn: { marginTop: 20 },
});
