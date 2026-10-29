import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withAndroidManifest, type ConfigPlugin } from 'expo/config-plugins';

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

/**
 * Android 11+ package visibility: lets the app check whether streaming apps
 * are installed (watch-together links). `android.queries` isn't part of the
 * Expo config schema, so this writes the <queries> block into the manifest.
 */
const withStreamingQueries: ConfigPlugin = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest as unknown as {
      queries?: { intent?: unknown[]; package?: unknown[] }[];
    };
    const queries = manifest.queries?.[0] ?? {};
    queries.intent = [
      ...(queries.intent ?? []),
      ...STREAMING_SCHEMES.map((scheme) => ({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': scheme } }],
      })),
    ];
    queries.package = [
      ...(queries.package ?? []),
      ...ANDROID_STREAMING_PACKAGES.map((pkg) => ({ $: { 'android:name': pkg } })),
    ];
    manifest.queries = [queries];
    return mod;
  });

export default ({ config: base }: ConfigContext): ExpoConfig => {
  // `base` is app.json's "expo" object, as Expo hands it in.
  const existing = (base.ios?.infoPlist?.LSApplicationQueriesSchemes as string[] | undefined) ?? [];

  const config: ExpoConfig = {
    ...base,
    name: base.name ?? 'Moments',
    slug: base.slug ?? 'moments',
    ios: {
      ...base.ios,
      infoPlist: {
        ...base.ios?.infoPlist,
        LSApplicationQueriesSchemes: [...new Set([...existing, ...STREAMING_SCHEMES])],
        // Calls keep going when you leave the app (audio) and can be woken for (voip).
        UIBackgroundModes: [
          ...new Set([...((base.ios?.infoPlist?.UIBackgroundModes as string[] | undefined) ?? []), 'audio', 'voip']),
        ],
      },
    },
    // Sentry: the org and project its plugin uploads source maps to at build time (with
    // SENTRY_AUTH_TOKEN as an EAS secret), so crash reports show our real code.
    plugins: [
      ...(base.plugins ?? []).map((p) =>
        p === '@sentry/react-native' && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
          ? (['@sentry/react-native', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }] as [
              string,
              Record<string, string>,
            ])
          : p,
      ),
    ],
    extra: {
      ...base.extra,
      eas: {
        ...(base.extra as { eas?: { projectId?: string } } | undefined)?.eas,
        projectId:
          (base.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
          'febe8159-67a5-41d8-988f-1b1291698f57',
      },
    },
  };
  return withStreamingQueries(config);
};
