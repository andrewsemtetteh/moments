import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = (platformId: string) => `watch_streaming_auth:${platformId}`;

/** URLs that mean the user reached the service home / browse (signed in). */
const AUTHENTICATED_PATTERNS: Record<string, RegExp[]> = {
  netflix: [/netflix\.com\/browse/i, /netflix\.com\/watch/i, /netflix\.com\/title/i, /netflix\.com\/profiles/i],
  disneyplus: [/disneyplus\.com\/home/i, /disneyplus\.com\/browse/i, /disneyplus\.com\/video/i, /disneyplus\.com\/select-profile/i],
  youtube: [/youtube\.com\/feed/i, /youtube\.com\/watch/i, /m\.youtube\.com/i, /youtube\.com\/?(\?|$)/i],
  hulu: [/hulu\.com\/hub/i, /hulu\.com\/watch/i, /hulu\.com\/series/i, /hulu\.com\/movie/i],
  max: [/play\.max\.com/i],
  primevideo: [/amazon\.com\/gp\/video/i, /primevideo\.com/i],
  appletv: [/tv\.apple\.com/i],
  paramountplus: [/paramountplus\.com\/home/i, /paramountplus\.com\/shows/i, /paramountplus\.com\/movies/i],
  crunchyroll: [/crunchyroll\.com\/\?/i, /crunchyroll\.com\/watch/i, /crunchyroll\.com\/series/i],
};

const SIGN_IN_PATTERNS = [
  /\/login/i,
  /\/signin/i,
  /\/sign-in/i,
  /\/auth\//i,
  /accounts\.google\.com/i,
  /appleid\.apple\.com/i,
  /\/oauth/i,
  /auth\.hulu\.com/i,
  /netflix\.com\/login/i,
  /disneyplus\.com\/login/i,
  /paramountplus\.com\/account\/signin/i,
];

export function isStreamingAuthenticatedUrl(platformId: string, url: string): boolean {
  const patterns = AUTHENTICATED_PATTERNS[platformId] ?? [];
  return patterns.some((p) => p.test(url));
}

export function isStreamingSignInUrl(url: string): boolean {
  return SIGN_IN_PATTERNS.some((p) => p.test(url));
}

export async function getStreamingAuthCached(platformId: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(AUTH_KEY(platformId));
    return v === '1';
  } catch {
    return false;
  }
}

export async function setStreamingAuthCached(platformId: string, authenticated: boolean): Promise<void> {
  try {
    if (authenticated) await AsyncStorage.setItem(AUTH_KEY(platformId), '1');
    else await AsyncStorage.removeItem(AUTH_KEY(platformId));
  } catch {
    // ignore storage errors
  }
}
