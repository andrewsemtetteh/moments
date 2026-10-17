import { useSignIn } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PasswordInput } from '@/components/auth/PasswordInput';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError } from '@/lib/auth-errors';
import { sanitizePasswordInput } from '@/lib/sanitize-input';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signIn, fetchStatus } = useSignIn();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Problems show once they've tapped Update, then update live as they fix them.
  const [tried, setTried] = useState(false);

  const loading = fetchStatus === 'fetching';

  useEffect(() => {
    if (signIn.status !== 'needs_new_password') {
      router.replace('/(auth)/login');
    }
    // Only checked once, on mount — status changes to 'complete' after a successful submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    const cleanPassword = sanitizePasswordInput(password);
    const cleanConfirm = sanitizePasswordInput(confirmPassword);
    if (loading) return;
    setTried(true);
    if (cleanPassword.length < 8 || cleanPassword !== cleanConfirm) return;

    try {
      const { error } = await signIn.resetPasswordEmailCode.submitPassword({ password: cleanPassword });
      if (error) throw error;

      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: () => {
            Alert.alert('Password updated', 'Your new password is ready. Welcome back.', [
              { text: 'Continue', onPress: () => router.replace('/') },
            ]);
          },
        });
      }
    } catch (e: unknown) {
      Alert.alert('Could not update password', formatAuthError(e));
    }
  };

  const passOk = password.length >= 8;
  const matches = password === confirmPassword;

  return (
    <OnboardingStepScreen
      title="Choose a new password"
      subtitle="Use at least 8 characters. You’ll sign in with it from now on."
      centered
      primaryLabel={loading ? 'Saving…' : 'Update password'}
      onPrimary={() => void handleSave()}
      busy={loading}
      // Changed your mind: back to signing in (the reset just isn't finished).
      onBack={() => router.replace('/(auth)/login')}>
      <PasswordInput
        variant="bold"
        label="New password"
        autoComplete="new-password"
        value={password}
        onChangeText={(text) => setPassword(sanitizePasswordInput(text))}
      />
      {tried && !passOk ? (
        <View style={styles.rule}>
          <Icon name="close" size={14} color={colors.error} />
          <Text style={[styles.ruleText, { color: colors.error }]}>Use at least 8 characters</Text>
        </View>
      ) : null}
      <PasswordInput
        variant="bold"
        label="Confirm new password"
        autoComplete="new-password"
        value={confirmPassword}
        onChangeText={(text) => setConfirmPassword(sanitizePasswordInput(text))}
      />
      {(tried || confirmPassword.length > 0) && !matches ? (
        <Text style={[styles.error, { color: colors.error }]}>Passwords don’t match</Text>
      ) : null}
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 13, marginTop: -6 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  ruleText: { fontSize: 13, fontWeight: '700' },
});
