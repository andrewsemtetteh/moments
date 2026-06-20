import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'apple';

export function getAuthRedirectUri() {
  return makeRedirectUri({
    scheme: 'moments',
    path: 'auth/callback',
  });
}

function getRedirectUri() {
  return getAuthRedirectUri();
}

export function isRecoveryCallbackUrl(url: string) {
  const { params } = QueryParams.getQueryParams(url);
  return params.type === 'recovery';
}

export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(errorCode);
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return;
  }

  const accessToken = params.access_token;
  if (accessToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: params.refresh_token ?? '',
    });
    if (error) throw error;
  }
}

async function signInWithOAuthProvider(provider: OAuthProvider): Promise<boolean> {
  const redirectTo = getRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('Could not start sign in. Please try again.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    showInRecents: true,
  });

  if (result.type === 'success') {
    await createSessionFromUrl(result.url);
    return true;
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return false;
  }

  throw new Error('Sign in was interrupted. Please try again.');
}

async function signInWithAppleNative(): Promise<boolean> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple Sign In failed — no identity token.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });

  if (error) throw error;

  if (credential.fullName) {
    const nameParts = [
      credential.fullName.givenName,
      credential.fullName.middleName,
      credential.fullName.familyName,
    ].filter(Boolean);

    if (nameParts.length > 0) {
      const fullName = nameParts.join(' ');
      await supabase.auth.updateUser({
        data: { name: fullName, full_name: fullName },
      });
    }
  }

  return true;
}

export async function signInWithApple(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const available = await AppleAuthentication.isAvailableAsync();
    if (available) {
      try {
        return await signInWithAppleNative();
      } catch (e: unknown) {
        const code =
          e && typeof e === 'object' && 'code' in e
            ? String((e as { code: string }).code)
            : '';
        if (code === 'ERR_REQUEST_CANCELED') return false;
        throw e;
      }
    }
  }

  return signInWithOAuthProvider('apple');
}

export async function signInWithGoogle(): Promise<boolean> {
  return signInWithOAuthProvider('google');
}
