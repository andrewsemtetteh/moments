import { useAuth, useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthChoiceButton } from '@/components/auth/AuthChoiceButton';
import { AuthLegalLinks } from '@/components/auth/AuthLegalLinks';
import { AuthTextField } from '@/components/auth/AuthTextField';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { useEnterApp } from '@/components/auth/useEnterApp';
import { AppleIcon, GoogleIcon } from '@/components/auth/OAuthBrandIcon';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { useSocialSignIn } from '@/components/auth/useSocialSignIn';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { separatorColor } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError } from '@/lib/auth-errors';
import { hasActiveSession, signOutUser } from '@/lib/auth-session';
import {
  getRememberedEmail,
  setRememberedEmail,
} from '@/lib/remember-me-storage';

// import { goBackOrReplace } from '@/lib/router'; // with the back arrow, below
import { sanitizeEmailInput, sanitizePasswordInput } from '@/lib/sanitize-input';

/** The second step a sign-in can need (two-step verification on the account). */
type SecondFactor = 'totp' | 'phone_code' | 'email_code' | 'backup_code';

const SECOND_FACTOR_COPY: Record<SecondFactor, { title: string; subtitle: string }> = {
  totp: { title: 'Two-step verification', subtitle: 'Enter the 6-digit code from your authenticator app.' },
  phone_code: { title: 'Check your phone', subtitle: 'We texted you a 6-digit code.' },
  email_code: { title: 'Check your email', subtitle: 'We emailed you a 6-digit code.' },
  backup_code: { title: 'Use a backup code', subtitle: 'Enter one of the backup codes you saved when you set up two-step verification.' },
};

/**
 * Sign in, in the onboarding style (same frame as the email sign-up and
 * verify pages): Apple / Google first, then email and password, with the
 * Sign in button over the keyboard.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signIn, errors, fetchStatus } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  // Signing in finishes by loading the account, then opening the app (see useEnterApp).
  const { enter, entering } = useEnterApp();
  // Set once this screen opens the app itself, so the leftover-session check below doesn't too.
  const autoTried = useRef(false);
  const enterNow = () => {
    autoTried.current = true;
    return enter();
  };
  const social = useSocialSignIn({ onSuccess: () => void enterNow() });
  const showApple = Platform.OS === 'ios' || Platform.OS === 'android';
  // Two-step verification: the method being used, and the code typed.
  const [factor, setFactor] = useState<SecondFactor | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [verifyingMfa, setVerifyingMfa] = useState(false);

  const loading = fetchStatus === 'fetching' || entering;

  /** Make the session active first, then load the account and open the app. */
  const finish = async () => {
    const { error } = await signIn.finalize();
    if (error) {
      Alert.alert('Couldn’t finish signing in', formatAuthError(error));
      return;
    }
    await enterNow();
  };

  /** The account asks for a second step: pick the best method it has (app, then text, then email). */
  const startSecondFactor = async () => {
    const offered = new Set((signIn.supportedSecondFactors ?? []).map((f) => f.strategy as string));
    const pick: SecondFactor | null = offered.has('totp')
      ? 'totp'
      : offered.has('phone_code')
        ? 'phone_code'
        : offered.has('email_code')
          ? 'email_code'
          : offered.has('backup_code')
            ? 'backup_code'
            : null;
    if (!pick) {
      Alert.alert('Can’t finish signing in', 'This account needs a verification method this app doesn’t support yet.');
      return;
    }
    if (pick === 'phone_code') {
      const { error } = await signIn.mfa.sendPhoneCode();
      if (error) return Alert.alert('Couldn’t send the code', formatAuthError(error));
    }
    if (pick === 'email_code') {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) return Alert.alert('Couldn’t send the code', formatAuthError(error));
    }
    setMfaCode('');
    setFactor(pick);
  };

  const verifySecondFactor = async () => {
    if (!factor || verifyingMfa) return;
    const code = mfaCode.trim();
    if (factor === 'backup_code' ? code.length < 6 : code.length !== 6) return;
    setVerifyingMfa(true);
    try {
      const { error } =
        factor === 'totp'
          ? await signIn.mfa.verifyTOTP({ code })
          : factor === 'phone_code'
            ? await signIn.mfa.verifyPhoneCode({ code })
            : factor === 'email_code'
              ? await signIn.mfa.verifyEmailCode({ code })
              : await signIn.mfa.verifyBackupCode({ code });
      if (error) {
        Alert.alert('That code didn’t work', formatAuthError(error));
        return;
      }
      if (signIn.status === 'complete') await finish();
    } finally {
      setVerifyingMfa(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const savedEmail = await getRememberedEmail();
      if (cancelled) return;
      if (savedEmail) setEmail(savedEmail);
      setPrefsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async () => {
    const cleanIdentifier = sanitizeEmailInput(email).trim();
    const cleanPassword = sanitizePasswordInput(password);
    if (!cleanIdentifier || !cleanPassword || loading) return;
    // Already signed in on this phone (the account just hadn't loaded): open it.
    if (hasActiveSession()) {
      await enterNow();
      return;
    }

    void setRememberedEmail(cleanIdentifier);

    const { error } = await signIn.password({ identifier: cleanIdentifier, password: cleanPassword });
    if (error) {
      Alert.alert('Sign in failed', formatAuthError(error));
      return;
    }

    switch (signIn.status) {
      case 'complete':
        await finish();
        return;
      case 'needs_second_factor':
      case 'needs_client_trust':
        await startSecondFactor();
        return;
      case 'needs_new_password':
        router.push('/(auth)/reset-password');
        return;
      default:
        Alert.alert('Couldn’t finish signing in', 'Something else is needed for this account. Try again, or reset your password.');
    }
  };

  // Already signed in on this phone, but the account didn't load (offline at launch, say).
  // Open it straight away; if that fails, offer Try again / Sign out, no password needed.
  const { isSignedIn } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    if (!isSignedIn || autoTried.current) return;
    autoTried.current = true;
    void enter();
  }, [isSignedIn, enter]);

  if (isSignedIn && !factor) {
    return (
      <OnboardingStepScreen
        title="Welcome back"
        subtitle={entering ? 'Opening your space…' : 'You’re signed in, but your space didn’t load. Check your connection and try again.'}
        centered
        primaryLabel={entering ? 'Opening…' : 'Try again'}
        onPrimary={() => void enter()}
        busy={entering || signingOut}
        secondaryLabel="Not you?"
        secondaryAction="Sign out"
        onSecondary={() => {
          setSigningOut(true);
          void signOutUser().finally(() => setSigningOut(false));
        }}
        onBack={null}
      />
    );
  }

  if (factor) {
    const copy = SECOND_FACTOR_COPY[factor];
    return (
      <OnboardingStepScreen
        title={copy.title}
        subtitle={copy.subtitle}
        centered
        primaryLabel={verifyingMfa || entering ? 'Verifying…' : 'Verify'}
        onPrimary={() => void verifySecondFactor()}
        primaryDisabled={factor === 'backup_code' ? mfaCode.trim().length < 6 : mfaCode.length !== 6}
        busy={verifyingMfa || entering}
        secondaryLabel={factor === 'backup_code' ? 'Back' : 'Use a backup code'}
        onSecondary={() => {
          setMfaCode('');
          setFactor(factor === 'backup_code' ? null : 'backup_code');
        }}
        onBack={() => {
          setFactor(null);
          setMfaCode('');
        }}>
        {factor === 'backup_code' ? (
          <AuthTextField
            variant="bold"
            label="Backup code"
            autoCapitalize="none"
            autoCorrect={false}
            value={mfaCode}
            onChangeText={(t) => setMfaCode(t.replace(/\s/g, ''))}
            returnKeyType="done"
            onSubmitEditing={() => void verifySecondFactor()}
          />
        ) : (
          <OtpCodeInput value={mfaCode} onChange={setMfaCode} />
        )}
      </OnboardingStepScreen>
    );
  }

  return (
    <OnboardingStepScreen
      title="Welcome back"
      subtitle="Sign in to your space."
      centered
      primaryLabel={loading ? 'Signing in…' : 'Sign in'}
      onPrimary={() => void handleLogin()}
      primaryDisabled={!email || !password || !prefsLoaded || social.busy}
      busy={loading}
      // Swap rather than stack, so switching between the two never piles up screens.
      secondaryLabel="New here?"
      secondaryAction="Create an account"
      onSecondary={() => router.replace('/(auth)/get-started')}
      // No back arrow here (swipe or the link below instead).
      // onBack={() => goBackOrReplace(router, '/(auth)/welcome')}
      onBack={null}>
      <View style={styles.social}>
        {showApple ? (
          <AuthChoiceButton
            variant="filled"
            label="Continue with Apple"
            icon={<AppleIcon size={20} color={colors.background} />}
            onPress={() => void social.start('apple')}
            loading={social.loadingProvider === 'apple'}
            disabled={social.busy || loading}
          />
        ) : null}
        <AuthChoiceButton
          label="Continue with Google"
          icon={<GoogleIcon size={18} />}
          onPress={() => void social.start('google')}
          loading={social.loadingProvider === 'google'}
          disabled={social.busy || loading}
        />
      </View>

      <View style={styles.orRow}>
        <View style={[styles.orLine, { backgroundColor: separatorColor(colors) }]} />
        <Text style={[styles.orText, { color: colors.textTertiary }]}>or with email</Text>
        <View style={[styles.orLine, { backgroundColor: separatorColor(colors) }]} />
      </View>

      <AuthTextField
        variant="bold"
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={(text) => setEmail(sanitizeEmailInput(text))}
        returnKeyType="next"
      />
      {errors.fields.identifier ? (
        <Text style={[styles.fieldError, { color: colors.error }]}>{errors.fields.identifier.message}</Text>
      ) : null}

      <PasswordInput
        variant="bold"
        label="Password"
        autoComplete="password"
        value={password}
        onChangeText={(text) => setPassword(sanitizePasswordInput(text))}
        returnKeyType="go"
        onSubmitEditing={() => void handleLogin()}
      />
      {errors.fields.password ? (
        <Text style={[styles.fieldError, { color: colors.error }]}>{errors.fields.password.message}</Text>
      ) : null}

      <View style={styles.optionsRow}>
        <Pressable
          onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: email ? { email } : undefined })}
          hitSlop={8}
          accessibilityRole="link">
          <Text style={[styles.forgot, { color: colors.text }]}>Forgot password?</Text>
        </Pressable>
      </View>

      <AuthLegalLinks prefix="By signing in you agree to our" style={styles.legal} />
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  social: { gap: 12 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 13, fontWeight: '800' },
  fieldError: { fontSize: 13, marginTop: -6 },
  // Just "Forgot password?" now, on the right (no "Remember me": you stay signed in).
  optionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  forgot: { fontSize: 14, fontWeight: '800', textDecorationLine: 'underline' },
  legal: { marginTop: 4 },
});
