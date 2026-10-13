import { useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { AuthLegalLinks } from '@/components/auth/AuthLegalLinks';
import { AuthTextField } from '@/components/auth/AuthTextField';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError, normalizeAuthEmail } from '@/lib/auth-errors';
import { sanitizeEmailInput, sanitizePasswordInput } from '@/lib/sanitize-input';
import { designPass } from '@/lib/onboarding-v2';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupEmailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signUp, errors: signUpErrors, fetchStatus } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const loading = fetchStatus === 'fetching';
  const emailValid = EMAIL_PATTERN.test(email);
  const canSubmit = emailValid && agreedToTerms && !loading;

  const handleCreateAccount = async () => {
    if (__DEV__ && designPass.on) {
      router.push({ pathname: '/(auth)/check-email', params: { email: email || 'you@example.com', type: 'signup' } });
      return;
    }
    if (!canSubmit) return;
    const cleanEmail = normalizeAuthEmail(sanitizeEmailInput(email));
    const cleanPassword = sanitizePasswordInput(password);
    if (cleanPassword.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }

    const { error } = await signUp.password({
      emailAddress: cleanEmail,
      password: cleanPassword,
    });
    if (error) {
      Alert.alert('Sign up failed', formatAuthError(error));
      return;
    }

    if (signUp.status === 'complete') {
      await signUp.finalize({ navigate: () => router.replace('/(onboarding)/about-you') });
      return;
    }

    if (signUp.unverifiedFields.includes('email_address')) {
      const { error: codeError } = await signUp.verifications.sendEmailCode();
      if (codeError) {
        Alert.alert('Sign up failed', formatAuthError(codeError));
        return;
      }
      router.push({
        pathname: '/(auth)/check-email',
        params: { email: cleanEmail, type: 'signup' },
      });
      return;
    }

    Alert.alert('Could not finish sign up', 'Please try again.');
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(auth)/get-started'));
  const passOk = password.length >= 8;

  return (
    <OnboardingStepScreen
      title="Sign up with email"
      subtitle="Use an email you actually check. It’s how you get back in if you ever switch phones."
      primaryLabel={loading ? 'Creating…' : 'Create account'}
      onPrimary={() => void handleCreateAccount()}
      primaryDisabled={!canSubmit && !(__DEV__ && designPass.on)}
      busy={loading}
      centered
      onBack={goBack}>
      <AuthTextField
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={(text) => setEmail(sanitizeEmailInput(text))}
        returnKeyType="next"
      />
      {signUpErrors.fields.emailAddress ? (
        <Text style={[styles.fieldError, { color: colors.error }]}>{signUpErrors.fields.emailAddress.message}</Text>
      ) : null}

      <PasswordInput
        label="Password"
        autoComplete="new-password"
        value={password}
        onChangeText={(text) => setPassword(sanitizePasswordInput(text))}
      />
      {/* Only while it's too short. */}
      {!passOk ? (
        <View style={styles.rule}>
          <Icon name="close" size={14} color={colors.textSecondary} />
          <Text style={[styles.ruleText, { color: colors.textSecondary }]}>At least 8 characters</Text>
        </View>
      ) : null}

      <View style={styles.agreementRow}>
        <AuthCheckbox checked={agreedToTerms} onToggle={() => setAgreedToTerms((v) => !v)} hitSlop={8} />
        <AuthLegalLinks prefix="I agree to the" centered={false} style={styles.agreementText} />
      </View>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  fieldError: { fontSize: 13, marginTop: -6 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  ruleText: { fontSize: 13, fontWeight: '700' },
  agreementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 6 },
  agreementText: { flex: 1, textAlign: 'left' },
});
