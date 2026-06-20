import { Alert, Linking, Platform } from 'react-native';

import { getStreamingPlatform } from '@/constants/streaming-platforms';

/** Android package + Play Store id for native app / intent fallbacks. */
const ANDROID_APPS: Record<string, { package: string; playStoreId: string }> = {
  netflix: { package: 'com.netflix.mediaclient', playStoreId: 'com.netflix.mediaclient' },
  disneyplus: { package: 'com.disney.disneyplus', playStoreId: 'com.disney.disneyplus' },
  youtube: { package: 'com.google.android.youtube', playStoreId: 'com.google.android.youtube' },
  hulu: { package: 'com.hulu.plus', playStoreId: 'com.hulu.plus' },
  max: { package: 'com.wbd.stream', playStoreId: 'com.wbd.stream' },
  primevideo: { package: 'com.amazon.avod.thirdpartyclient', playStoreId: 'com.amazon.avod.thirdpartyclient' },
  paramountplus: { package: 'com.cbs.ott', playStoreId: 'com.cbs.app' },
  crunchyroll: { package: 'com.crunchyroll.crunchyroid', playStoreId: 'com.crunchyroll.crunchyroid' },
};

export type OpenStreamingResult = 'native' | 'web' | 'store' | 'failed';

async function tryOpenURL(url: string, options?: { force?: boolean }): Promise<boolean> {
  try {
    if (!options?.force) {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) return false;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Android intent:// URL — opens app if installed without crashing on bare schemes. */
function androidIntentUrl(platformId: string, httpsPath: string): string | null {
  const pkg = ANDROID_APPS[platformId]?.package;
  if (!pkg) return null;
  const path = httpsPath.replace(/^https?:\/\//, '');
  return `intent://${path}#Intent;package=${pkg};scheme=https;end`;
}

export async function openStreamingSignIn(platformId: string): Promise<void> {
  const platform = getStreamingPlatform(platformId);
  await tryOpenURL(platform.signInUrl);
}

/**
 * Opens the native streaming app when installed.
 * Never throws — falls back to Play Store, then mobile web.
 */
export async function openStreamingApp(
  platformId: string,
  link?: string | null,
  options?: { showAlerts?: boolean },
): Promise<OpenStreamingResult> {
  const platform = getStreamingPlatform(platformId);
  const showAlerts = options?.showAlerts ?? true;
  const customLink = link?.trim();
  const androidApp = ANDROID_APPS[platformId];

  if (customLink) {
    if (await tryOpenURL(customLink)) return 'native';
  }

  if (Platform.OS === 'android' && androidApp) {
    const intent = androidIntentUrl(platformId, platform.watchUrl);
    if (intent && (await tryOpenURL(intent, { force: true }))) return 'native';

    const scheme = platform.appOpenUrl;
    if (scheme && !/^https?:\/\//i.test(scheme) && (await tryOpenURL(scheme, { force: true }))) {
      return 'native';
    }

    const storeUrl = `market://details?id=${androidApp.playStoreId}`;
    if (await tryOpenURL(storeUrl, { force: true })) {
      if (showAlerts) {
        Alert.alert(
          `Install ${platform.name}`,
          `${platform.name} is not installed. Opening the Play Store — install it, then try again.`,
        );
      }
      return 'store';
    }
  }

  if (Platform.OS === 'ios') {
    const scheme = platform.appOpenUrl;
    if (scheme && !/^https?:\/\//i.test(scheme) && (await tryOpenURL(scheme))) return 'native';
  }

  if (await tryOpenURL(platform.watchUrl)) {
    if (showAlerts && Platform.OS === 'android' && androidApp) {
      Alert.alert(
        `${platform.name} app not found`,
        `Opening ${platform.name} in your browser. Install the app from the Play Store for the best experience.`,
      );
    }
    return 'web';
  }

  if (showAlerts) {
    Alert.alert('Could not open', `Unable to open ${platform.name}. Try installing the app from your app store.`);
  }
  return 'failed';
}
