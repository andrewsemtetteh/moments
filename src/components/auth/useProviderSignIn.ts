import { useSignInWithApple } from '@clerk/expo/apple';
import { useSSO } from '@clerk/expo/experimental';
import { useSignInWithGoogle } from '@clerk/expo/google';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export type SocialProvider = 'apple' | 'google';

type FlowResult = Awaited<ReturnType<ReturnType<typeof useSSO>['startSSOFlow']>>;

/** Expo Go can't run native sign-in (its bundle id isn't ours): use the browser flow there. */
const IN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
/** Native Google: Google's account picker, branded "Moments" (needs the Google client ids). */
const NATIVE_GOOGLE =
  !IN_EXPO_GO && Platform.OS !== 'web' && !!process.env.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID;
/** Native Apple: the system Sign in with Apple sheet (iPhone only; Android uses the browser flow). */
const NATIVE_APPLE = !IN_EXPO_GO && Platform.OS === 'ios';

/** Errors that mean "native isn't set up here", where the browser flow is the right fallback. */
function nativeUnavailable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return /not available|native module|credentials not found|not configured|DEVELOPER_ERROR/i.test(msg);
}

/**
 * Apple / Google sign-in: native where possible, the Clerk browser flow otherwise.
 * Same result shape either way; a native session is made active here (the browser flow does it itself).
 */
export function useProviderSignIn() {
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const { startGoogleAuthenticationFlow } = useSignInWithGoogle();

  const browser = (provider: SocialProvider) =>
    startSSOFlow({ strategy: provider === 'apple' ? 'oauth_apple' : 'oauth_google' });

  return async (provider: SocialProvider): Promise<FlowResult> => {
    const useNative = provider === 'apple' ? NATIVE_APPLE : NATIVE_GOOGLE;
    if (!useNative) return browser(provider);
    try {
      const result =
        provider === 'apple' ? await startAppleAuthenticationFlow() : await startGoogleAuthenticationFlow();
      if (result.createdSessionId && result.setActive) await result.setActive({ session: result.createdSessionId });
      return result as FlowResult;
    } catch (e) {
      if (nativeUnavailable(e)) {
        console.warn(`[auth] native ${provider} sign-in unavailable, using the browser`, e);
        return browser(provider);
      }
      throw e;
    }
  };
}
