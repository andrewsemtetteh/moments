import { useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { AuthLegalLinks } from '@/components/auth/AuthLegalLinks';
import { AuthTextField } from '@/components/auth/AuthTextField';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError, normalizeAuthEmail } from '@/lib/auth-errors';
import { emailProblem, emailSuggestion } from '@/lib/email-validation';
import { sanitizeEmailInput, sanitizePasswordInput } from '@/lib/sanitize-input';
import { designPass } from '@/lib/onboarding-v2';
import { MIN_AGE } from '@/lib/birthday';

export default function SignupEmailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signUp, errors: signUpErrors, fetchStatus } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  // Problems only show once they've tried (or left a filled-in email field),
  // then update live as they fix them.
  const [tried, setTried] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const loading = fetchStatus === 'fetching';
  // Set the instant it's tapped: `loading` only turns on once the request is under way,
  // so a quick double tap used to create the account twice.
  const submitting = useRef(false);
  const emailError = emailProblem(email);
  const suggestion = emailSuggestion(email);
  const passOk = password.length >= 8;
  const showEmailError = !!emailError && (tried || (emailTouched && email.trim().length > 0));

  const handleCreateAccount = async () => {
    if (__DEV__ && designPass.on) {
      router.push({ pathname: '/(auth)/check-email', params: { email: email || 'you@example.com', type: 'signup' } });
      return;
    }
    if (loading || submitting.current) return;
    setTried(true);
    if (emailError || !passOk || !agreedToTerms) return;
    submitting.current = true;
    try {
      await createAccount();
    } finally {
      submitting.current = false;
    }
  };

  const createAccount = async () => {
    const cleanEmail = normalizeAuthEmail(sanitizeEmailInput(email));
    const cleanPassword = sanitizePasswordInput(password);

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

  return (
    <OnboardingStepScreen
      title="Sign up with email"
      subtitle="Your email and a password. That’s it."
      primaryLabel={loading ? 'Creating…' : 'Create account'}
      onPrimary={() => void handleCreateAccount()}
      // Always tappable: a tap shows what still needs fixing.
      busy={loading}
      centered
      secondaryLabel="I already have an account"
      secondaryAction="Sign in"
      onSecondary={() => router.replace('/(auth)/login')}
      onBack={goBack}>
      <AuthTextField
        variant="bold"
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={(text) => setEmail(sanitizeEmailInput(text))}
        onBlur={() => setEmailTouched(true)}
        returnKeyType="next"
      />
      {showEmailError ? (
        <Text style={[styles.fieldError, { color: colors.error }]}>{emailError}</Text>
      ) : suggestion ? (
        <Pressable onPress={() => setEmail(suggestion)} hitSlop={6} accessibilityRole="button">
          <Text style={[styles.fieldError, { color: colors.textSecondary }]}>
            Did you mean <Text style={[styles.suggestion, { color: colors.text }]}>{suggestion}</Text>?
          </Text>
        </Pressable>
      ) : signUpErrors.fields.emailAddress ? (
        <Text style={[styles.fieldError, { color: colors.error }]}>{signUpErrors.fields.emailAddress.message}</Text>
      ) : null}

      <PasswordInput
        variant="bold"
        label="Password"
        autoComplete="new-password"
        value={password}
        onChangeText={(text) => setPassword(sanitizePasswordInput(text))}
      />
      {/* Only after they've tried, and only while it's still too short. */}
      {tried && !passOk ? (
        <View style={styles.rule}>
          <Icon name="close" size={14} color={colors.error} />
          <Text style={[styles.ruleText, { color: colors.error }]}>Use at least 8 characters</Text>
        </View>
      ) : null}

      <View style={styles.agreementRow}>
        <AuthCheckbox checked={agreedToTerms} onToggle={() => setAgreedToTerms((v) => !v)} hitSlop={8} />
        <AuthLegalLinks prefix={`I’m ${MIN_AGE} or older and agree to the`} centered={false} style={styles.agreementText} />
      </View>
      {tried && !agreedToTerms ? (
        <Text style={[styles.fieldError, styles.center, { color: colors.error }]}>
          Tick the box to agree before creating your account.
        </Text>
      ) : null}
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  fieldError: { fontSize: 13, marginTop: -6 },
  suggestion: { fontWeight: '800', textDecorationLine: 'underline' },
  center: { textAlign: 'center' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  ruleText: { fontSize: 13, fontWeight: '700' },
  // Centred under the fields, like the rest of the screen.
  agreementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6 },
  agreementText: { flexShrink: 1, textAlign: 'left' },
});
