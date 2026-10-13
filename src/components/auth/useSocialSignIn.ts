import { useSSO } from '@clerk/expo/experimental';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert } from 'react-native';

import { formatAuthError } from '@/lib/auth-errors';

export type SocialProvider = 'apple' | 'google';

/**
 * Apple / Google sign-in (one flow for signing up and signing in: Clerk makes
 * the account if it's new). On success it calls `onSuccess`; cancelling just
 * stops the spinner.
 */
export function useSocialSignIn({ onSuccess, beforeStart }: { onSuccess: () => void; beforeStart?: () => Promise<void> | void }) {
  const { startSSOFlow } = useSSO();
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);

  const start = async (provider: SocialProvider) => {
    const label = provider === 'apple' ? 'Apple' : 'Google';
    setLoadingProvider(provider);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await beforeStart?.();
      const { createdSessionId, signIn, signUp } = await startSSOFlow({
        strategy: provider === 'apple' ? 'oauth_apple' : 'oauth_google',
      });
      if (createdSessionId) {
        onSuccess();
        return;
      }
      if (signIn?.existingSession || signUp?.existingSession) {
        Alert.alert(
          `Already signed in with ${label}`,
          'This account is already signed in on another session. Sign out there first, or use a different account.',
        );
        return;
      }
      if (signUp?.status === 'missing_requirements') {
        Alert.alert(
          `${label} sign up incomplete`,
          'Your account needs additional info to finish signing up. Please try again or use email instead.',
        );
      }
      // Otherwise they cancelled.
    } catch (e: unknown) {
      Alert.alert(`${label} sign in failed`, formatAuthError(e));
    } finally {
      setLoadingProvider(null);
    }
  };

  return { start, loadingProvider, busy: loadingProvider !== null };
}
