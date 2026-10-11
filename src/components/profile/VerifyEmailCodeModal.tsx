import { Pressable, StyleSheet, Text } from 'react-native';

import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { PrimaryButton } from '@/components/ui/primitives';
import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  visible: boolean;
  email: string;
  code: string;
  saving?: boolean;
  onChangeCode: (code: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function VerifyEmailCodeModal({
  visible,
  email,
  code,
  saving = false,
  onChangeCode,
  onClose,
  onSave,
}: Props) {
  const { colors } = useTheme();

  return (
    <DraggableSheet visible={visible} onClose={onClose} avoidKeyboard style={styles.sheet}>
      <Text style={[styles.title, { color: colors.text }]}>Verify your new email</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Enter the 6-digit code we sent to {email}
      </Text>
      <OtpCodeInput value={code} onChange={onChangeCode} />
      <PrimaryButton
        label={saving ? 'Verifying…' : 'Verify'}
        onPress={onSave}
        loading={saving}
        disabled={code.length !== 6}
        style={styles.button}
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
  label: { fontSize: 14, marginBottom: 16, lineHeight: 19 },
  button: { marginTop: 20 },
  cancel: { alignItems: 'center', marginTop: 14 },
});
