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
import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { hydrateAuthSession } from '@/lib/auth-session';
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
    if (password.length < 6 || password !== confirmPassword) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
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
          <View style={styles.content}>
            <View style={styles.brand}>
              <Text style={[styles.title, { color: colors.text }]}>Choose a new password</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Enter a new password with at least 6 characters.
              </Text>
            </View>

            <View style={styles.form}>
              <PasswordInput
                placeholder="New password"
                autoComplete="new-password"
                value={password}
                onChangeText={setPassword}
              />
              <PasswordInput
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text style={[styles.error, { color: colors.error }]}>Passwords do not match</Text>
              )}
              <PrimaryButton
                label={loading ? 'Saving…' : 'Update password'}
                onPress={handleSave}
                loading={loading}
                disabled={!canSave}
              />
            </View>
          </View>
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
    paddingVertical: 32,
    justifyContent: 'center',
  },
  content: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 10, lineHeight: 22, maxWidth: 300 },
  form: { gap: 12 },
  error: { fontSize: 13, marginTop: -4 },
});
