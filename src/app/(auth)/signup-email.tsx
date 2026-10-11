import { useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { AuthLegalLinks } from '@/components/auth/AuthLegalLinks';
import { AuthTextField } from '@/components/auth/AuthTextField';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { OnboardingChrome } from '@/components/onboarding/OnboardingChrome';
import { PrimaryButton } from '@/components/ui/primitives';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError, normalizeAuthEmail } from '@/lib/auth-errors';
import { goToOnboardingBack } from '@/lib/onboarding-navigation';
import { sanitizeEmailInput, sanitizePasswordInput } from '@/lib/sanitize-input';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signUp, errors: signUpErrors, fetchStatus } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const loading = fetchStatus === 'fetching';
  const emailValid = EMAIL_PATTERN.test(email);
  const canSubmit = emailValid && agreedToTerms && !loading;

  const handleCreateAccount = async () => {
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
      await signUp.finalize({ navigate: () => router.replace('/(onboarding)/profile-name') });
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

  const goBack = () => goToOnboardingBack(router, 'signup-email');

  return (
    <OnboardingChrome stepId="signup-email" onBack={goBack}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.lg, paddingHorizontal: Spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Create your account</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            We&apos;ll use this to set up your account.
          </Text>

          <View style={styles.form}>
            <AuthTextField
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
              value={email}
              onChangeText={(text) => setEmail(sanitizeEmailInput(text))}
              returnKeyType="next"
            />
            {signUpErrors.fields.emailAddress && (
              <Text style={[styles.fieldError, { color: colors.error }]}>
                {signUpErrors.fields.emailAddress.message}
              </Text>
            )}

            <PasswordInput
              label="Password"
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChangeText={(text) => setPassword(sanitizePasswordInput(text))}
              containerStyle={styles.passwordField}
            />

            <View style={styles.agreementRow}>
              <View style={styles.checkboxWrap}>
                <AuthCheckbox checked={agreedToTerms} onToggle={() => setAgreedToTerms((v) => !v)} hitSlop={8} />
              </View>
              <AuthLegalLinks prefix="I agree to the" centered={false} style={styles.agreementText} />
            </View>

            <PrimaryButton
              label={loading ? 'Creating…' : 'Create Account'}
              onPress={handleCreateAccount}
              loading={loading}
              disabled={!canSubmit}
              style={styles.btn}
            />
          </View>
        </View>
      </ScrollView>
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 10, maxWidth: 300 },
  form: { width: '100%', marginTop: 28, gap: 10 },
  fieldError: { fontSize: 13, marginTop: -4 },
  passwordField: { marginTop: 2 },
  agreementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4, width: '100%' },
  checkboxWrap: { marginTop: 1 },
  agreementText: { flex: 1, textAlign: 'left' },
  btn: { width: '100%', marginTop: 20 },
});
