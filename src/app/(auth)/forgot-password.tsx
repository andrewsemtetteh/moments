import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/ui/Logo';
import { AuthFooter } from '@/components/auth/AuthFooter';
import { AuthScreenEnter } from '@/components/auth/AuthMotion';
import { AuthTextField } from '@/components/auth/AuthTextField';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { useTheme } from '@/hooks/useTheme';
import { sendPasswordResetLink, formatAuthError } from '@/lib/auth-otp';
import { sanitizeEmailInput } from '@/lib/sanitize-input';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(
    typeof params.email === 'string' ? sanitizeEmailInput(params.email) : '',
  );
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const trimmed = sanitizeEmailInput(email).trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const { error } = await sendPasswordResetLink(trimmed);
      if (error) throw error;
      router.push({
        pathname: '/(auth)/check-email',
        params: { email: trimmed, type: 'recovery' },
      });
    } catch (e: unknown) {
      Alert.alert('Could not send email', formatAuthError(e));
    } finally {
      setLoading(false);
    }
  };

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
              <Text style={[styles.title, { color: colors.text }]}>Reset password</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Enter your email and we&apos;ll send a 6-digit code to verify it&apos;s you.
              </Text>
            </View>

            <View style={styles.form}>
              <AuthTextField
                label="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={(text) => setEmail(sanitizeEmailInput(text))}
              />
              <AuthPrimaryButton
                label={loading ? 'Sending…' : 'Send code'}
                onPress={handleSend}
                loading={loading}
                disabled={!email.trim() || loading}
              />
            </View>

            <AuthFooter prompt="Remember your password?" linkLabel="Back to sign in" href="/(auth)/login" />
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
});
