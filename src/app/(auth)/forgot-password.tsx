import { useSignIn } from '@clerk/expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { AuthTextField } from '@/components/auth/AuthTextField';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError, normalizeAuthEmail } from '@/lib/auth-errors';
import { emailProblem, emailSuggestion } from '@/lib/email-validation';
import { goBackOrReplace } from '@/lib/router';
import { sanitizeEmailInput } from '@/lib/sanitize-input';

/** Forgot password: same look as sign-in. Send a code to the email, then check-email. */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signIn, fetchStatus } = useSignIn();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? sanitizeEmailInput(params.email) : '');
  // Problems show once they've tried (or left a filled-in field), then update live.
  const [tried, setTried] = useState(false);
  const [touched, setTouched] = useState(false);

  const loading = fetchStatus === 'fetching';
  const problem = emailProblem(email);
  const suggestion = emailSuggestion(email);
  const showProblem = !!problem && (tried || (touched && email.trim().length > 0));

  const handleSend = async () => {
    if (loading) return;
    setTried(true);
    if (problem) return;
    const trimmed = normalizeAuthEmail(sanitizeEmailInput(email));

    try {
      const { error: createError } = await signIn.create({ identifier: trimmed });
      // No account for that email: carry on exactly as if there were (no code ever arrives),
      // so this screen can't be used to find out who has an account.
      const noAccount = !!createError && /identifier_not_found|couldn.?t find your account|not found/i.test(
        `${(createError as { code?: string }).code ?? ''} ${createError.message ?? ''}`,
      );
      if (createError && !noAccount) throw createError;

      if (!noAccount) {
        const { error } = await signIn.resetPasswordEmailCode.sendCode();
        if (error) throw error;
      }

      router.push({
        pathname: '/(auth)/check-email',
        params: { email: trimmed, type: 'recovery' },
      });
    } catch (e: unknown) {
      Alert.alert('Could not send email', formatAuthError(e));
    }
  };

  return (
    <OnboardingStepScreen
      title="Reset password"
      subtitle="Enter your email and we’ll send a 6-digit code to verify it’s you."
      centered
      primaryLabel={loading ? 'Sending…' : 'Send code'}
      onPrimary={() => void handleSend()}
      busy={loading}
      secondaryLabel="Remember it?"
      secondaryAction="Sign in"
      onSecondary={() => router.replace('/(auth)/login')}
      onBack={() => goBackOrReplace(router, '/(auth)/login')}>
      <AuthTextField
        variant="bold"
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={(text) => setEmail(sanitizeEmailInput(text))}
        onBlur={() => setTouched(true)}
        returnKeyType="send"
        onSubmitEditing={() => void handleSend()}
      />
      {showProblem ? (
        <Text style={[styles.fieldError, { color: colors.error }]}>{problem}</Text>
      ) : suggestion ? (
        <Pressable onPress={() => setEmail(suggestion)} hitSlop={6} accessibilityRole="button">
          <Text style={[styles.fieldError, { color: colors.textSecondary }]}>
            Did you mean <Text style={[styles.suggestion, { color: colors.text }]}>{suggestion}</Text>?
          </Text>
        </Pressable>
      ) : null}
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  fieldError: { fontSize: 13, marginTop: -6 },
  suggestion: { fontWeight: '800', textDecorationLine: 'underline' },
});
