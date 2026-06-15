import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  visible: boolean;
  title: string;
  label: string;
  value: string;
  placeholder?: string;
  saving?: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function EditFieldModal({
  visible,
  title,
  label,
  value,
  placeholder,
  saving = false,
  onChange,
  onClose,
  onSave,
}: Props) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]} onPress={() => undefined}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            autoFocus
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          />
          <PrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={onSave} loading={saving} disabled={!value.trim()} />
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
  label: { fontSize: 14, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    marginBottom: 16,
  },
  cancel: { alignItems: 'center', marginTop: 14 },
});
