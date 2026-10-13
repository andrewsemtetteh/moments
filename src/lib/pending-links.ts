import AsyncStorage from '@react-native-async-storage/async-storage';

const INVITE_KEY = 'pending_invite_code';
const REFERRAL_KEY = 'pending_referral_code';

/** A partner's invite code from a link, waiting for the join step. */
export async function setPendingInvite(code: string) {
  await AsyncStorage.setItem(INVITE_KEY, code.toUpperCase()).catch(() => undefined);
}
export async function getPendingInvite(): Promise<string | null> {
  return AsyncStorage.getItem(INVITE_KEY).catch(() => null);
}
export async function clearPendingInvite() {
  await AsyncStorage.removeItem(INVITE_KEY).catch(() => undefined);
}

/** Another couple's referral code from a link, waiting to be claimed once signed in. */
export async function setPendingReferral(code: string) {
  await AsyncStorage.setItem(REFERRAL_KEY, code.toUpperCase()).catch(() => undefined);
}
export async function getPendingReferral(): Promise<string | null> {
  return AsyncStorage.getItem(REFERRAL_KEY).catch(() => null);
}
export async function clearPendingReferral() {
  await AsyncStorage.removeItem(REFERRAL_KEY).catch(() => undefined);
}
