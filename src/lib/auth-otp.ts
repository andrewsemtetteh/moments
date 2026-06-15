import type { EmailOtpType } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type OtpFlowType = 'signup' | 'recovery';

export function otpVerifyType(flow: OtpFlowType): EmailOtpType {
  return flow === 'recovery' ? 'recovery' : 'signup';
}

export async function sendSignupOtp(email: string) {
  return supabase.auth.resend({ type: 'signup', email });
}

export async function sendRecoveryOtp(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
}

export async function verifyEmailOtp(email: string, token: string, flow: OtpFlowType) {
  const primary = await supabase.auth.verifyOtp({
    email,
    token,
    type: otpVerifyType(flow),
  });

  if (!primary.error || flow !== 'signup') return primary;

  // Some Supabase projects use `email` type for signup confirmation codes.
  return supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
}

export async function resendOtp(email: string, flow: OtpFlowType) {
  if (flow === 'recovery') return sendRecoveryOtp(email);
  return sendSignupOtp(email);
}
