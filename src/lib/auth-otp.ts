import type { SignUpWithPasswordCredentials } from '@supabase/supabase-js';

import { getAuthRedirectUri } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';

export type EmailVerificationFlow = 'signup' | 'recovery';

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isRateLimitedAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('security purposes') ||
    lower.includes('for security reasons') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('once every')
  );
}

export function formatAuthError(error: unknown): string {
  if (!(error instanceof Error)) return 'Please try again.';
  if (isRateLimitedAuthError(error.message)) {
    return 'Please wait about a minute before trying again. If you already signed up, check your inbox and spam for the verification link.';
  }
  return error.message;
}

export async function resendConfirmationEmail(email: string) {
  return supabase.auth.resend({
    type: 'signup',
    email: normalizeAuthEmail(email),
    options: { emailRedirectTo: getAuthRedirectUri() },
  });
}

export async function sendPasswordResetLink(email: string) {
  return supabase.auth.resetPasswordForEmail(normalizeAuthEmail(email), {
    redirectTo: getAuthRedirectUri(),
  });
}

export type RegisterAccountResult = {
  email: string;
  session: Awaited<ReturnType<typeof supabase.auth.signUp>>['data']['session'];
  needsVerification: boolean;
  error: Error | null;
};

export async function registerAccount(params: {
  email: string;
  password: string;
  name: string;
}): Promise<RegisterAccountResult> {
  const email = normalizeAuthEmail(params.email);
  const password = params.password;
  const name = params.name.trim();

  const credentials: SignUpWithPasswordCredentials = {
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: getAuthRedirectUri(),
    },
  };

  const { data, error } = await supabase.auth.signUp(credentials);

  if (error) {
    if (isRateLimitedAuthError(error.message)) {
      return {
        email,
        session: null,
        needsVerification: true,
        error: null,
      };
    }

    return {
      email,
      session: null,
      needsVerification: false,
      error,
    };
  }

  if (data.session) {
    return {
      email,
      session: data.session,
      needsVerification: false,
      error: null,
    };
  }

  if (data.user && data.user.identities?.length === 0) {
    return {
      email,
      session: null,
      needsVerification: false,
      error: new Error('An account with this email already exists. Try signing in instead.'),
    };
  }

  return {
    email,
    session: null,
    needsVerification: true,
    error: null,
  };
}
