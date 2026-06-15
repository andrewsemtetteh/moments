import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { resendOtp, verifyEmailOtp, type OtpFlowType } from '@/lib/auth-otp';
import { hydrateAuthSession } from '@/lib/auth-session';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ email?: string; type?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const flow: OtpFlowType = params.type === 'recovery' ? 'recovery' : 'signup';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!email) router.replace('/(auth)/login');
  }, [email, router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (code.length !== 6 || !email) return;
    setLoading(true);
    try {
      const { data, error } = await verifyEmailOtp(email, code, flow);
      if (error) throw error;
      if (!data.session) throw new Error('Invalid or expired code. Please try again.');

      if (flow === 'recovery') {
        router.replace('/(auth)/reset-password');
        return;
      }

      await hydrateAuthSession(data.session);
      router.replace('/(onboarding)/profile-setup');
    } catch (e: unknown) {
      Alert.alert('Verification failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;
    try {
      const { error } = await resendOtp(email, flow);
      if (error) throw error;
      setResendCooldown(60);
      Alert.alert('Code sent', 'Check your email for a new 6-digit code.');
    } catch (e: unknown) {
      Alert.alert('Could not resend', e instanceof Error ? e.message : 'Please try again');
    }
  };

  const title = flow === 'recovery' ? 'Enter reset code' : 'Verify your email';
  const subtitle =
    flow === 'recovery'
      ? `We sent a 6-digit code to ${email}. Enter it to reset your password.`
      : `We sent a 6-digit code to ${email}. Enter it to activate your account.`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

            <OtpCodeInput value={code} onChange={setCode} />

            <PrimaryButton
              label={loading ? 'Verifying…' : 'Continue'}
              onPress={handleVerify}
              loading={loading}
              disabled={code.length !== 6 || loading}
            />

            <Pressable onPress={handleResend} disabled={resendCooldown > 0} hitSlop={8}>
              <Text style={[styles.resend, { color: resendCooldown > 0 ? colors.textTertiary : colors.accent }]}>
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </Text>
            </Pressable>

            <Pressable onPress={() => router.replace(flow === 'recovery' ? '/(auth)/forgot-password' : '/(auth)/signup')} hitSlop={8}>
              <Text style={[styles.back, { color: colors.textSecondary }]}>Go back</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: 24 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  resend: { textAlign: 'center', fontSize: 15, fontWeight: '600' },
  back: { textAlign: 'center', fontSize: 15 },
});
