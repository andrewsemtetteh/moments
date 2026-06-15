import {
  siAppletv,
  siCrunchyroll,
  siMax,
  siNetflix,
  siParamountplus,
  siShowtime,
  siSpotify,
  siStarz,
  siTubi,
  siTwitch,
  siYoutube,
} from 'simple-icons';

export type BrandIcon =
  | { type: 'svg'; path: string; hex: string }
  | { type: 'label'; label: string; hex: string; fontSize?: number };

/** Lookup by platform id — must match `streaming-platforms.ts`. */
const BRAND_BY_PLATFORM_ID: Record<string, BrandIcon> = {
  netflix: { type: 'svg', path: siNetflix.path, hex: siNetflix.hex },
  disneyplus: { type: 'label', label: 'D+', hex: '113CCF', fontSize: 11 },
  hulu: { type: 'label', label: 'hulu', hex: '1CE783', fontSize: 9 },
  max: { type: 'svg', path: siMax.path, hex: siMax.hex },
  primevideo: { type: 'label', label: 'prime', hex: '00A8E1', fontSize: 8 },
  appletv: { type: 'svg', path: siAppletv.path, hex: siAppletv.hex },
  peacock: { type: 'label', label: 'NBC', hex: '000000', fontSize: 9 },
  paramountplus: { type: 'svg', path: siParamountplus.path, hex: siParamountplus.hex },
  crunchyroll: { type: 'svg', path: siCrunchyroll.path, hex: siCrunchyroll.hex },
  youtube: { type: 'svg', path: siYoutube.path, hex: siYoutube.hex },
  tubi: { type: 'svg', path: siTubi.path, hex: siTubi.hex },
  pluto: { type: 'label', label: 'pluto', hex: '1B1451', fontSize: 8 },
  spotify: { type: 'svg', path: siSpotify.path, hex: siSpotify.hex },
  twitch: { type: 'svg', path: siTwitch.path, hex: siTwitch.hex },
  discoveryplus: { type: 'label', label: 'disc+', hex: '2175D9', fontSize: 8 },
  espn: { type: 'label', label: 'ESPN', hex: 'CC0000', fontSize: 8 },
  starz: { type: 'svg', path: siStarz.path, hex: siStarz.hex },
  showtime: { type: 'svg', path: siShowtime.path, hex: siShowtime.hex },
};

export function getStreamingBrandIcon(platformId: string): BrandIcon | null {
  if (platformId === 'other') return null;
  return BRAND_BY_PLATFORM_ID[platformId] ?? null;
}
