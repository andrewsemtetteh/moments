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

export interface StreamingPlatform {
  id: StreamingPlatformId;
  name: string;
  signInUrl: string;
  brandColor: string;
}

/** Platforms shown in the Watch Together service picker (order matters). */
export const STREAMING_PLATFORMS: StreamingPlatform[] = [
  { id: 'netflix', name: 'Netflix', signInUrl: 'https://www.netflix.com/login', brandColor: '#E50914' },
  { id: 'disneyplus', name: 'Disney+', signInUrl: 'https://www.disneyplus.com/login', brandColor: '#113CCF' },
  { id: 'youtube', name: 'YouTube', signInUrl: 'https://www.youtube.com/signin', brandColor: '#FF0000' },
  { id: 'hulu', name: 'Hulu', signInUrl: 'https://auth.hulu.com/web/login', brandColor: '#1CE783' },
  { id: 'max', name: 'HBO Max', signInUrl: 'https://play.max.com/profile-picker', brandColor: '#002BE7' },
  { id: 'primevideo', name: 'Prime Video', signInUrl: 'https://www.amazon.com/ap/signin', brandColor: '#00A8E1' },
  { id: 'appletv', name: 'Apple TV+', signInUrl: 'https://tv.apple.com/', brandColor: '#000000' },
  { id: 'paramountplus', name: 'Paramount+', signInUrl: 'https://www.paramountplus.com/account/signin/', brandColor: '#0064FF' },
  { id: 'crunchyroll', name: 'Crunchyroll', signInUrl: 'https://www.crunchyroll.com/login', brandColor: '#F47521' },
];

const LEGACY_PLATFORMS: Record<string, StreamingPlatform> = {
  peacock: { id: 'other', name: 'Peacock', signInUrl: 'https://www.peacocktv.com/signin', brandColor: '#000000' },
  tubi: { id: 'other', name: 'Tubi', signInUrl: 'https://tubitv.com/login', brandColor: '#FA382F' },
  pluto: { id: 'other', name: 'Pluto TV', signInUrl: 'https://pluto.tv/en/account/sign-in', brandColor: '#FFD500' },
  spotify: { id: 'other', name: 'Spotify', signInUrl: 'https://accounts.spotify.com/login', brandColor: '#1DB954' },
  twitch: { id: 'other', name: 'Twitch', signInUrl: 'https://www.twitch.tv/login', brandColor: '#9146FF' },
  discoveryplus: { id: 'other', name: 'Discovery+', signInUrl: 'https://auth.discoveryplus.com/login', brandColor: '#2175D9' },
  espn: { id: 'other', name: 'ESPN', signInUrl: 'https://www.espn.com/watch/', brandColor: '#CC0000' },
  starz: { id: 'other', name: 'Starz', signInUrl: 'https://www.starz.com/us/en/login', brandColor: '#000000' },
  showtime: { id: 'other', name: 'Showtime', signInUrl: 'https://www.showtime.com/', brandColor: '#B100FF' },
};

const OTHER: StreamingPlatform = {
  id: 'other',
  name: 'Other',
  signInUrl: 'https://www.google.com/search?q=streaming+login',
  brandColor: '#6B6B78',
};

export function getStreamingPlatform(id: string): StreamingPlatform {
  return (
    STREAMING_PLATFORMS.find((p) => p.id === id) ??
    LEGACY_PLATFORMS[id] ??
    OTHER
  );
}
