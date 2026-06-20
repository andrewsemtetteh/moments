export type StreamingPlatformId =
  | 'netflix'
  | 'disneyplus'
  | 'youtube'
  | 'hulu'
  | 'max'
  | 'primevideo'
  | 'appletv'
  | 'paramountplus'
  | 'crunchyroll'
  | 'other';

/** Rave-style playback: in-app web/iframe where allowed; premium tries WebView + native fallback. */
export type StreamingPlaybackMode =
  | 'youtube_inapp'
  | 'free_webview'
  | 'premium_hybrid'
  | 'companion';

export interface StreamingPlatform {
  id: StreamingPlatformId;
  name: string;
  signInUrl: string;
  appOpenUrl: string;
  watchUrl: string;
  playbackMode: StreamingPlaybackMode;
  brandColor: string;
}

export const STREAMING_PLATFORMS: StreamingPlatform[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    signInUrl: 'https://www.netflix.com/login',
    appOpenUrl: 'nflx://',
    watchUrl: 'https://www.netflix.com/browse',
    playbackMode: 'premium_hybrid',
    brandColor: '#E50914',
  },
  {
    id: 'disneyplus',
    name: 'Disney+',
    signInUrl: 'https://www.disneyplus.com/login',
    appOpenUrl: 'disneyplus://',
    watchUrl: 'https://www.disneyplus.com/home',
    playbackMode: 'premium_hybrid',
    brandColor: '#113CCF',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    signInUrl: 'https://www.youtube.com/signin',
    appOpenUrl: 'youtube://',
    watchUrl: 'https://m.youtube.com',
    playbackMode: 'youtube_inapp',
    brandColor: '#FF0000',
  },
  {
    id: 'hulu',
    name: 'Hulu',
    signInUrl: 'https://auth.hulu.com/web/login',
    appOpenUrl: 'hulu://',
    watchUrl: 'https://www.hulu.com/hub/home',
    playbackMode: 'premium_hybrid',
    brandColor: '#1CE783',
  },
  {
    id: 'max',
    name: 'HBO Max',
    signInUrl: 'https://play.max.com/profile-picker',
    appOpenUrl: 'max://',
    watchUrl: 'https://play.max.com/',
    playbackMode: 'premium_hybrid',
    brandColor: '#002BE7',
  },
  {
    id: 'primevideo',
    name: 'Prime Video',
    signInUrl: 'https://www.amazon.com/ap/signin',
    appOpenUrl: 'primevideo://',
    watchUrl: 'https://www.amazon.com/gp/video/storefront',
    playbackMode: 'premium_hybrid',
    brandColor: '#00A8E1',
  },
  {
    id: 'appletv',
    name: 'Apple TV+',
    signInUrl: 'https://tv.apple.com/',
    appOpenUrl: 'videos://',
    watchUrl: 'https://tv.apple.com/',
    playbackMode: 'premium_hybrid',
    brandColor: '#000000',
  },
  {
    id: 'paramountplus',
    name: 'Paramount+',
    signInUrl: 'https://www.paramountplus.com/account/signin/',
    appOpenUrl: 'paramountplus://',
    watchUrl: 'https://www.paramountplus.com/',
    playbackMode: 'premium_hybrid',
    brandColor: '#0064FF',
  },
  {
    id: 'crunchyroll',
    name: 'Crunchyroll',
    signInUrl: 'https://www.crunchyroll.com/login',
    appOpenUrl: 'crunchyroll://',
    watchUrl: 'https://www.crunchyroll.com/',
    playbackMode: 'free_webview',
    brandColor: '#F47521',
  },
];

const LEGACY_PLATFORMS: Record<string, StreamingPlatform> = {
  peacock: {
    id: 'other',
    name: 'Peacock',
    signInUrl: 'https://www.peacocktv.com/signin',
    appOpenUrl: 'https://www.peacocktv.com/',
    watchUrl: 'https://www.peacocktv.com/',
    playbackMode: 'free_webview',
    brandColor: '#000000',
  },
  tubi: {
    id: 'other',
    name: 'Tubi',
    signInUrl: 'https://tubitv.com/login',
    appOpenUrl: 'https://tubitv.com/',
    watchUrl: 'https://tubitv.com/',
    playbackMode: 'free_webview',
    brandColor: '#FA382F',
  },
  pluto: {
    id: 'other',
    name: 'Pluto TV',
    signInUrl: 'https://pluto.tv/en/account/sign-in',
    appOpenUrl: 'https://pluto.tv/',
    watchUrl: 'https://pluto.tv/',
    playbackMode: 'free_webview',
    brandColor: '#FFD500',
  },
  spotify: {
    id: 'other',
    name: 'Spotify',
    signInUrl: 'https://accounts.spotify.com/login',
    appOpenUrl: 'spotify://',
    watchUrl: 'https://open.spotify.com/',
    playbackMode: 'companion',
    brandColor: '#1DB954',
  },
  twitch: {
    id: 'other',
    name: 'Twitch',
    signInUrl: 'https://www.twitch.tv/login',
    appOpenUrl: 'https://www.twitch.tv/',
    watchUrl: 'https://www.twitch.tv/',
    playbackMode: 'free_webview',
    brandColor: '#9146FF',
  },
  discoveryplus: {
    id: 'other',
    name: 'Discovery+',
    signInUrl: 'https://auth.discoveryplus.com/login',
    appOpenUrl: 'https://www.discoveryplus.com/',
    watchUrl: 'https://www.discoveryplus.com/',
    playbackMode: 'premium_hybrid',
    brandColor: '#2175D9',
  },
  espn: {
    id: 'other',
    name: 'ESPN',
    signInUrl: 'https://www.espn.com/watch/',
    appOpenUrl: 'https://www.espn.com/watch/',
    watchUrl: 'https://www.espn.com/watch/',
    playbackMode: 'free_webview',
    brandColor: '#CC0000',
  },
  starz: {
    id: 'other',
    name: 'Starz',
    signInUrl: 'https://www.starz.com/us/en/login',
    appOpenUrl: 'https://www.starz.com/',
    watchUrl: 'https://www.starz.com/',
    playbackMode: 'premium_hybrid',
    brandColor: '#000000',
  },
  showtime: {
    id: 'other',
    name: 'Showtime',
    signInUrl: 'https://www.showtime.com/',
    appOpenUrl: 'https://www.showtime.com/',
    watchUrl: 'https://www.showtime.com/',
    playbackMode: 'premium_hybrid',
    brandColor: '#B100FF',
  },
};

const OTHER: StreamingPlatform = {
  id: 'other',
  name: 'Other',
  signInUrl: 'https://www.google.com/search?q=streaming+login',
  appOpenUrl: 'https://www.google.com/search?q=streaming+apps',
  watchUrl: 'https://www.google.com/search?q=streaming+watch',
  playbackMode: 'companion',
  brandColor: '#6B6B78',
};

export function getStreamingPlatform(id: string): StreamingPlatform {
  return STREAMING_PLATFORMS.find((p) => p.id === id) ?? LEGACY_PLATFORMS[id] ?? OTHER;
}

export function resolveWatchUrl(platformId: string): string {
  return getStreamingPlatform(platformId).watchUrl;
}

/** In-app WebView / iframe (YouTube + free + premium try). */
export function usesHybridInApp(platformId: string | null | undefined): boolean {
  if (!platformId) return false;
  const mode = getStreamingPlatform(platformId).playbackMode;
  return mode === 'youtube_inapp' || mode === 'free_webview' || mode === 'premium_hybrid';
}

/** @deprecated Use usesHybridInApp */
export function usesInAppWebView(platformId: string | null | undefined): boolean {
  return usesHybridInApp(platformId);
}

export function usesDrmWebView(platformId: string | null | undefined): boolean {
  return usesHybridInApp(platformId);
}

export function usesNativeCompanionOnly(platformId: string | null | undefined): boolean {
  if (!platformId) return true;
  return getStreamingPlatform(platformId).playbackMode === 'companion';
}

export function skipsSignInGate(_platformId: string): boolean {
  return true;
}

/** In-app only — no native app redirect UI. */
export function showNativeAppFallback(_platformId: string): boolean {
  return false;
}
