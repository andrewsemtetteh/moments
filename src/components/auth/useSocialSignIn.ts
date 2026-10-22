import * as Haptics from '@/lib/haptics';
import { useState } from 'react';
import { Alert } from 'react-native';

import { formatAuthError } from '@/lib/auth-errors';

import { useProviderSignIn, type SocialProvider } from './useProviderSignIn';

export type { SocialProvider };

/**
 * Apple / Google sign-in (one flow for signing up and signing in: Clerk makes
 * the account if it's new). On success it calls `onSuccess`; cancelling just
 * stops the spinner.
 */
export function useSocialSignIn({ onSuccess, beforeStart }: { onSuccess: () => void; beforeStart?: () => Promise<void> | void }) {
  // Native Apple / Google where available, the browser flow otherwise.
  const signInWith = useProviderSignIn();
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);

  const start = async (provider: SocialProvider) => {
    const label = provider === 'apple' ? 'Apple' : 'Google';
    setLoadingProvider(provider);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await beforeStart?.();
      const { createdSessionId, signIn, signUp } = await signInWith(provider);
      if (createdSessionId) {
        onSuccess();
        return;
      }
      // Already signed in to this account on this phone (Clerk switches to that session): carry on.
      if (signIn?.existingSession || signUp?.existingSession) {
        onSuccess();
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
