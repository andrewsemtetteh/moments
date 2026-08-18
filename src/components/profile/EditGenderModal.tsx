import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { PROFILE_GENDER_OPTIONS } from '@/lib/profile-gender';
import type { ProfileGender } from '@/types/database';

type Props = {
  visible: boolean;
  value: ProfileGender | null;
  saving?: boolean;
  onChange: (value: ProfileGender) => void;
  onClose: () => void;
  onSave: () => void;
};

export function EditGenderModal({
  visible,
  value,
  saving = false,
  onChange,
  onClose,
  onSave,
}: Props) {
  const { colors } = useTheme();

  return (
    <DraggableSheet visible={visible} onClose={onClose} style={styles.sheet}>
          <Text style={[styles.title, { color: colors.text }]}>Gender</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            This helps us personalize your experience
          </Text>

          <View style={styles.options}>
            {PROFILE_GENDER_OPTIONS.map((option) => {
              const selected = value === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onChange(option.value);
                  }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}>
                  <Text style={[styles.optionLabel, { color: selected ? colors.accent : colors.text }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <PrimaryButton
            label={saving ? 'Saving…' : 'Save'}
            onPress={onSave}
            loading={saving}
            disabled={!value}
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
  title: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  label: { fontSize: 14, marginBottom: 16 },
  options: { gap: 10, marginBottom: 20 },
  option: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
  },
  optionLabel: { fontSize: 16, fontWeight: '600' },
  cancel: { alignItems: 'center', marginTop: 14 },
});
