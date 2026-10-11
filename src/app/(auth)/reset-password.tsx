import { useSignIn } from '@clerk/expo';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/auth/PasswordInput';
import { AuthScreenEnter } from '@/components/auth/AuthMotion';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError } from '@/lib/auth-errors';
import { sanitizePasswordInput } from '@/lib/sanitize-input';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signIn, fetchStatus } = useSignIn();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
    if (cleanPassword.length < 6 || cleanPassword !== cleanConfirm) return;

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

  const canSave =
    password.length >= 6 && confirmPassword.length >= 6 && password === confirmPassword && !loading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <AuthScreenEnter style={styles.content}>
            <View style={styles.brand}>
              <Text style={[styles.title, { color: colors.text }]}>Choose a new password</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Enter a new password with at least 8 characters.
              </Text>
            </View>

            <View style={styles.form}>
              <PasswordInput
                label="New password"
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChangeText={(text) => setPassword(sanitizePasswordInput(text))}
              />
              <PasswordInput
                label="Confirm new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChangeText={(text) => setConfirmPassword(sanitizePasswordInput(text))}
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text style={[styles.error, { color: colors.error }]}>Passwords do not match</Text>
              )}
              <AuthPrimaryButton
                label={loading ? 'Saving…' : 'Update password'}
                onPress={handleSave}
                loading={loading}
                disabled={!canSave}
              />
            </View>
          </AuthScreenEnter>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    justifyContent: 'center',
  },
  content: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: 24, gap: 12 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 21, maxWidth: 300 },
  form: { gap: 10 },
  error: { fontSize: 13, marginTop: -4 },
});
