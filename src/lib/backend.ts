import { Platform } from 'react-native';

import { API_URL, cloudflare } from '@/lib/cloudflare';

/**
 * Backend client: the Cloudflare Worker (D1 + R2 + Durable Object realtime) with Clerk auth.
 * Every feature imports `backend` from here — see `src/lib/cloudflare.ts`.
 */
export const backend = cloudflare;

export function getBackend() {
  return cloudflare;
}

export const isBackendConfigured = API_URL.length > 0;

export const isNativeApp = Platform.OS !== 'web';
