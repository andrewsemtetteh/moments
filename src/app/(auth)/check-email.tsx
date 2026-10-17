import { useSignIn, useSignUp } from '@clerk/expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { EnvelopeCharacter } from '@/components/onboarding/Characters';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError, normalizeAuthEmail } from '@/lib/auth-errors';
import { designPass } from '@/lib/onboarding-v2';

const RESEND_COOLDOWN_SECONDS = 60;
type Flow = 'signup' | 'recovery';

export default function CheckEmailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
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
    if (__DEV__ && designPass.on) {
      router.replace({ pathname: '/(onboarding)/about-you', params: { preview: '1' } });
      return;
    }
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    try {
      if (flow === 'recovery') {
        const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code });
        if (error) throw error;
        // Every outcome goes somewhere (it used to sit here unless a new password was needed).
        if (signIn.status === 'needs_new_password') {
          router.replace('/(auth)/reset-password');
        } else if (signIn.status === 'complete') {
          await signIn.finalize({ navigate: () => router.replace('/') });
        } else {
          Alert.alert('Almost there', 'Sign in with your email and password to carry on.', [
            { text: 'OK', onPress: () => router.replace('/(auth)/login') },
          ]);
        }
        return;
      }

      const { error } = await signUp.verifications.verifyEmailCode({ code });
      if (error) throw error;
      if (signUp.status === 'complete') {
        await signUp.finalize({ navigate: () => router.replace('/(onboarding)/about-you') });
      }
    } catch (e: unknown) {
      Alert.alert('Invalid code', formatAuthError(e));
    } finally {
      setVerifying(false);
    }
  };

  const backTo = flow === 'recovery' ? '/(auth)/forgot-password' : '/(auth)/signup-email';
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(backTo));

  return (
    <OnboardingStepScreen
      art={<EnvelopeCharacter size={170} />}
      title="Check your email"
      subtitle={`We sent a 6 digit code to ${email}${flow === 'recovery' ? ' to reset your password' : ''}. Check spam if it’s not there.`}
      primaryLabel={verifying ? 'Verifying…' : 'Verify'}
      onPrimary={() => void handleVerify()}
      primaryDisabled={(code.length !== 6 || verifying) && !(__DEV__ && designPass.on)}
      busy={verifying}
      centered
      // No back arrow here; "Wrong email? Change it" is the way back.
      onBack={null}>
      {/* Opens calm: tap the boxes to type (or paste from Mail). */}
      <OtpCodeInput value={code} onChange={setCode} autoFocus={false} />

      <Pressable onPress={() => void handleResend()} disabled={resendCooldown > 0 || resending} hitSlop={8} style={styles.linkRow}>
        <Text style={[styles.muted, { color: colors.textSecondary }]}>
          Didn’t get it?{' '}
          <Text style={[styles.strong, { color: resendCooldown > 0 || resending ? colors.textTertiary : colors.text }]}>
            {resending ? 'Sending…' : resendCooldown > 0 ? `Resend in 0:${String(resendCooldown).padStart(2, '0')}` : 'Resend code'}
          </Text>
        </Text>
      </Pressable>
      <Pressable onPress={goBack} hitSlop={8} style={styles.linkRow}>
        <Text style={[styles.strong, { color: colors.text }]}>Wrong email? Change it</Text>
      </Pressable>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  linkRow: { alignItems: 'center', paddingVertical: 2 },
  muted: { fontSize: 14 },
  strong: { fontSize: 14, fontWeight: '800' },
});
