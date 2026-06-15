export type StreamingPlatformId =
  | 'netflix'
  | 'disneyplus'
  | 'hulu'
  | 'max'
  | 'primevideo'
  | 'appletv'
  | 'peacock'
  | 'paramountplus'
  | 'crunchyroll'
  | 'youtube'
  | 'tubi'
  | 'pluto'
  | 'spotify'
  | 'twitch'
  | 'discoveryplus'
  | 'espn'
  | 'starz'
  | 'showtime'
  | 'other';

export interface StreamingPlatform {
  id: StreamingPlatformId;
  name: string;
  signInUrl: string;
  brandColor: string;
}

export const STREAMING_PLATFORMS: StreamingPlatform[] = [
  { id: 'netflix', name: 'Netflix', signInUrl: 'https://www.netflix.com/login', brandColor: '#E50914' },
  { id: 'disneyplus', name: 'Disney+', signInUrl: 'https://www.disneyplus.com/login', brandColor: '#113CCF' },
  { id: 'hulu', name: 'Hulu', signInUrl: 'https://auth.hulu.com/web/login', brandColor: '#1CE783' },
  { id: 'max', name: 'Max', signInUrl: 'https://play.max.com/profile-picker', brandColor: '#002BE7' },
  { id: 'primevideo', name: 'Prime Video', signInUrl: 'https://www.amazon.com/ap/signin', brandColor: '#00A8E1' },
  { id: 'appletv', name: 'Apple TV', signInUrl: 'https://tv.apple.com/', brandColor: '#000000' },
  { id: 'peacock', name: 'Peacock', signInUrl: 'https://www.peacocktv.com/signin', brandColor: '#000000' },
  { id: 'paramountplus', name: 'Paramount+', signInUrl: 'https://www.paramountplus.com/account/signin/', brandColor: '#0064FF' },
  { id: 'crunchyroll', name: 'Crunchyroll', signInUrl: 'https://www.crunchyroll.com/login', brandColor: '#F47521' },
  { id: 'youtube', name: 'YouTube', signInUrl: 'https://www.youtube.com/signin', brandColor: '#FF0000' },
  { id: 'tubi', name: 'Tubi', signInUrl: 'https://tubitv.com/login', brandColor: '#FA382F' },
  { id: 'pluto', name: 'Pluto TV', signInUrl: 'https://pluto.tv/en/account/sign-in', brandColor: '#FFD500' },
  { id: 'spotify', name: 'Spotify', signInUrl: 'https://accounts.spotify.com/login', brandColor: '#1DB954' },
  { id: 'twitch', name: 'Twitch', signInUrl: 'https://www.twitch.tv/login', brandColor: '#9146FF' },
  { id: 'discoveryplus', name: 'Discovery+', signInUrl: 'https://auth.discoveryplus.com/login', brandColor: '#2175D9' },
  { id: 'espn', name: 'ESPN', signInUrl: 'https://www.espn.com/watch/', brandColor: '#CC0000' },
  { id: 'starz', name: 'Starz', signInUrl: 'https://www.starz.com/us/en/login', brandColor: '#000000' },
  { id: 'showtime', name: 'Showtime', signInUrl: 'https://www.showtime.com/', brandColor: '#B100FF' },
  { id: 'other', name: 'Other', signInUrl: 'https://www.google.com/search?q=streaming+login', brandColor: '#6B6B78' },
];

export function getStreamingPlatform(id: string): StreamingPlatform {
  return STREAMING_PLATFORMS.find((p) => p.id === id) ?? STREAMING_PLATFORMS[STREAMING_PLATFORMS.length - 1];
}
