import { useSignIn, useSignUp } from '@clerk/expo';
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
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError, normalizeAuthEmail } from '@/lib/auth-errors';

const RESEND_COOLDOWN_SECONDS = 60;
type Flow = 'signup' | 'recovery';

export default function CheckEmailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const linkColors = authLinkColors(colors);
  const params = useLocalSearchParams<{ email?: string; type?: string }>();
  const email = typeof params.email === 'string' ? normalizeAuthEmail(params.email) : '';
  const flow: Flow = params.type === 'recovery' ? 'recovery' : 'signup';

  const { signUp } = useSignUp();
  const { signIn } = useSignIn();

  const [code, setCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);

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
        flow === 'recovery' ? await signIn.resetPasswordEmailCode.sendCode() : await signUp.verifications.sendEmailCode();
      if (error) throw error;

      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      Alert.alert('Code sent', `Check your inbox at ${email} for a new code.`);
    } catch (e: unknown) {
      Alert.alert('Could not resend', formatAuthError(e));
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    try {
      if (flow === 'recovery') {
        const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code });
        if (error) throw error;
        if (signIn.status === 'needs_new_password') {
          router.replace('/(auth)/reset-password');
        }
        return;
      }

      const { error } = await signUp.verifications.verifyEmailCode({ code });
      if (error) throw error;
      if (signUp.status === 'complete') {
        await signUp.finalize({ navigate: () => router.replace('/(onboarding)/profile-name') });
      }
    } catch (e: unknown) {
      Alert.alert('Invalid code', formatAuthError(e));
    } finally {
      setVerifying(false);
    }
  };

  const title = flow === 'recovery' ? 'Check your email' : 'Verify your email';
  const subtitle = `We sent a 6-digit code to ${email}. Enter it below${
    flow === 'recovery' ? ' to reset your password' : ' to activate your account'
  }. Check spam if you don't see it.`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <AuthScreenEnter style={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

            <OtpCodeInput value={code} onChange={setCode} />

            <AuthPrimaryButton
              label={verifying ? 'Verifying…' : 'Verify'}
              onPress={handleVerify}
              loading={verifying}
              disabled={code.length !== 6 || verifying}
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
                    ? `Resend code in ${resendCooldown}s`
                    : 'Resend code'}
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
