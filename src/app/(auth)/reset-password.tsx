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

import { LogoMark } from '@/components/ui/Logo';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { AuthScreenEnter } from '@/components/auth/AuthMotion';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { useTheme } from '@/hooks/useTheme';
import { hydrateAuthSession } from '@/lib/auth-session';
import { sanitizePasswordInput } from '@/lib/sanitize-input';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session) router.replace('/(auth)/login');
      setCheckingSession(false);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSave = async () => {
    const cleanPassword = sanitizePasswordInput(password);
    const cleanConfirm = sanitizePasswordInput(confirmPassword);
    if (cleanPassword.length < 6 || cleanPassword !== cleanConfirm) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: cleanPassword });
      if (error) throw error;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) await hydrateAuthSession(session);

      Alert.alert('Password updated', 'Your new password is ready. Welcome back.', [
        { text: 'Continue', onPress: () => router.replace('/') },
      ]);
    } catch (e: unknown) {
      Alert.alert('Could not update password', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const canSave =
    password.length >= 6 &&
    confirmPassword.length >= 6 &&
    password === confirmPassword &&
    !loading &&
    !checkingSession;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <AuthScreenEnter style={styles.content}>
            <View style={styles.brand}>
              <LogoMark size={64} />
              <Text style={[styles.title, { color: colors.text }]}>Choose a new password</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Enter a new password with at least 6 characters.
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
