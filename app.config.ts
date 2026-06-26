import type { ConfigContext, ExpoConfig } from 'expo/config';

const STREAMING_SCHEMES = [
  'nflx',
  'disneyplus',
  'youtube',
  'hulu',
  'max',
  'primevideo',
  'videos',
  'paramountplus',
  'crunchyroll',
];

const ANDROID_STREAMING_PACKAGES = [
  'com.netflix.mediaclient',
  'com.disney.disneyplus',
  'com.google.android.youtube',
  'com.hulu.plus',
  'com.wbd.stream',
  'com.amazon.avod.thirdpartyclient',
  'com.cbs.ott',
  'com.crunchyroll.crunchyroid',
];

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = require('./app.json').expo;
  const existing = (base.ios?.infoPlist?.LSApplicationQueriesSchemes as string[] | undefined) ?? [];

  return {
    ...base,
    ios: {
      ...base.ios,
      infoPlist: {
        ...base.ios?.infoPlist,
        LSApplicationQueriesSchemes: [...new Set([...existing, ...STREAMING_SCHEMES])],
      },
    },
    android: {
      ...base.android,
      queries: [
        ...((base.android?.queries as object[] | undefined) ?? []),
        ...STREAMING_SCHEMES.map((scheme) => ({ scheme })),
        ...ANDROID_STREAMING_PACKAGES.map((pkg) => ({ package: pkg })),
      ],
    },
    extra: {
      ...base.extra,
      eas: {
        ...(base.extra as { eas?: { projectId?: string } } | undefined)?.eas,
        projectId:
          (base.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
          'febe8159-67a5-41d8-988f-1b1291698f57',
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.EXPO_PUBLIC_SUPABASE_KEY,
    },
  };
};
