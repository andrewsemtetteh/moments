import { StyleSheet, Text, View } from 'react-native';

import { PasswordInput } from '@/components/auth/PasswordInput';
import { SettingsEditPage } from '@/components/profile/SettingsEditPage';
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

/** Change password on its own page: current, new, confirm. */
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
  const sameAsOld = newPassword.length > 0 && newPassword === currentPassword;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <SettingsEditPage
      visible={visible}
      title="Password"
      hint="Enter your current password, then choose a new one with at least 6 characters."
      buttonLabel="Update password"
      canSave={canSave}
      saving={saving}
      onSave={onSave}
      onClose={onClose}>
      <View style={styles.fields}>
        <PasswordInput
          label="Current password"
          autoComplete="current-password"
          value={currentPassword}
          onChangeText={onChangeCurrent}
          fieldBackgroundColor={colors.surface}
        />
        <PasswordInput
          label="New password"
          minLength={6}
          autoComplete="new-password"
          value={newPassword}
          onChangeText={onChangeNew}
          fieldBackgroundColor={colors.surface}
        />
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          value={confirmPassword}
          onChangeText={onChangeConfirm}
          fieldBackgroundColor={colors.surface}
        />
      </View>
      {sameAsOld ? (
        <Text style={[styles.error, { color: colors.error }]}>Your new password must be different.</Text>
      ) : mismatch ? (
        <Text style={[styles.error, { color: colors.error }]}>The new passwords don’t match.</Text>
      ) : null}
    </SettingsEditPage>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 12 },
  error: { fontSize: 14, fontWeight: '600' },
});
