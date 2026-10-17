import { StyleSheet, Text, View } from 'react-native';

import { PasswordInput } from '@/components/auth/PasswordInput';
import { SettingsEditPage } from '@/components/profile/SettingsEditPage';
import { useTheme } from '@/hooks/useTheme';

/** Same rule as signing up. */
export const MIN_PASSWORD_LENGTH = 8;

type Props = {
  visible: boolean;
  /** Signed up with Apple or Google: there's no current password, they're setting their first. */
  settingFirst?: boolean;
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
  settingFirst = false,
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
    (settingFirst || currentPassword.length > 0) &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    newPassword === confirmPassword &&
    (settingFirst || newPassword !== currentPassword);
  const sameAsOld = !settingFirst && newPassword.length > 0 && newPassword === currentPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <SettingsEditPage
      visible={visible}
      title="Password"
      hint={
        settingFirst
          ? `You sign in with Apple or Google. Add a password (at least ${MIN_PASSWORD_LENGTH} characters) to sign in with your email too.`
          : `Enter your current password, then choose a new one with at least ${MIN_PASSWORD_LENGTH} characters.`
      }
      buttonLabel={settingFirst ? 'Set password' : 'Update password'}
      canSave={canSave}
      saving={saving}
      onSave={onSave}
      onClose={onClose}>
      <View style={styles.fields}>
        {settingFirst ? null : (
          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            value={currentPassword}
            onChangeText={onChangeCurrent}
            fieldBackgroundColor={colors.surface}
          />
        )}
        <PasswordInput
          label="New password"
          minLength={MIN_PASSWORD_LENGTH}
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
      {tooShort ? (
        <Text style={[styles.error, { color: colors.error }]}>Use at least {MIN_PASSWORD_LENGTH} characters.</Text>
      ) : sameAsOld ? (
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
