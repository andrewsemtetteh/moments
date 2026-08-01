import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authLinkColors, authLinkStyles } from '@/components/auth/auth-link-styles';
import { AuthScreenEnter } from '@/components/auth/AuthMotion';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { useTheme } from '@/hooks/useTheme';
import {
    formatAuthError,
    normalizeAuthEmail,
    resendConfirmationEmail,
    sendPasswordResetLink,
    type EmailVerificationFlow,
} from '@/lib/auth-otp';

const RESEND_COOLDOWN_SECONDS = 60;

export default function CheckEmailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const linkColors = authLinkColors(colors);
  const params = useLocalSearchParams<{ email?: string; type?: string }>();
  const email = typeof params.email === 'string' ? normalizeAuthEmail(params.email) : '';
  const flow: EmailVerificationFlow = params.type === 'recovery' ? 'recovery' : 'signup';

  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!email) router.replace('/(auth)/login');
  }, [email, router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!email || resendCooldown > 0 || resending) return;

    setResending(true);
    try {
      const { error } =
        flow === 'recovery'
          ? await sendPasswordResetLink(email)
          : await resendConfirmationEmail(email);
      if (error) throw error;

      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      Alert.alert(
        'Email sent',
        flow === 'recovery'
          ? 'Check your inbox for a new password reset link.'
          : 'Check your inbox for a new verification link.',
      );
    } catch (e: unknown) {
      Alert.alert('Could not resend', formatAuthError(e));
    } finally {
      setResending(false);
    }
  };

  const title = flow === 'recovery' ? 'Check your email' : 'Verify your email';
  const subtitle =
    flow === 'recovery'
      ? `We sent a password reset link to ${email}. Open it on this device to choose a new password.`
      : `We sent a verification link to ${email}. Open it on this device to activate your account. Check spam if you do not see it.`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <AuthScreenEnter style={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

            <AuthPrimaryButton
              label="Back to sign in"
              onPress={() => router.replace('/(auth)/login')}
            />

            <Pressable
              onPress={handleResend}
              disabled={resendCooldown > 0 || resending}
              hitSlop={8}>
              <Text
                style={[
                  authLinkStyles.inlineLink,
                  styles.resend,
                  {
                    color:
                      resendCooldown > 0 || resending ? linkColors.legalMuted : linkColors.emphasis,
                  },
                ]}>
                {resending
                  ? 'Sending…'
                  : resendCooldown > 0
                    ? `Resend email in ${resendCooldown}s`
                    : 'Resend email'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace(flow === 'recovery' ? '/(auth)/forgot-password' : '/(auth)/signup')}
              hitSlop={8}>
              <Text style={[styles.back, { color: linkColors.muted }]}>Go back</Text>
            </Pressable>
          </AuthScreenEnter>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: 20 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  resend: { textAlign: 'center', fontSize: 15 },
  back: { textAlign: 'center', fontSize: 15 },
});
