import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PasswordInput } from '@/components/auth/PasswordInput';
import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  visible: boolean;
  saving?: boolean;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onChangeCurrent: (value: string) => void;
  onChangeNew: (value: string) => void;
  onChangeConfirm: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function ChangePasswordModal({
  visible,
  saving = false,
  currentPassword,
  newPassword,
  confirmPassword,
  onChangeCurrent,
  onChangeNew,
  onChangeConfirm,
  onClose,
  onSave,
}: Props) {
  const { colors } = useTheme();
  const canSave =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    confirmPassword.length >= 6 &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]} onPress={() => undefined}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>Change password</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Enter your current password, then choose a new one with at least 6 characters.
          </Text>
          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            value={currentPassword}
            onChangeText={onChangeCurrent}
            labelBackgroundColor={colors.backgroundElevated}
            containerStyle={styles.input}
          />
          <PasswordInput
            label="New password"
            minLength={6}
            autoComplete="new-password"
            value={newPassword}
            onChangeText={onChangeNew}
            labelBackgroundColor={colors.backgroundElevated}
            containerStyle={styles.input}
          />
          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChangeText={onChangeConfirm}
            labelBackgroundColor={colors.backgroundElevated}
            containerStyle={styles.input}
          />
          {newPassword.length > 0 && newPassword === currentPassword && (
            <Text style={[styles.error, { color: colors.error }]}>New password must be different</Text>
          )}
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <Text style={[styles.error, { color: colors.error }]}>New passwords do not match</Text>
          )}
          <PrimaryButton
            label={saving ? 'Saving…' : 'Update password'}
            onPress={onSave}
            loading={saving}
            disabled={!canSave || saving}
          />
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
  label: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  input: { marginBottom: 12 },
  error: { fontSize: 13, marginBottom: 12, marginTop: -4 },
  cancel: { alignItems: 'center', marginTop: 14 },
});
