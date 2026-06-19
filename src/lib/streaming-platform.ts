import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import { getStreamingPlatform } from '@/constants/streaming-platforms';

/** Opens the sign-in page — only when user explicitly adds a service to their profile. */
export async function openStreamingSignIn(platformId: string) {
  const platform = getStreamingPlatform(platformId);
  await WebBrowser.openBrowserAsync(platform.signInUrl);
}

/** Opens the streaming app on the user's phone (they stay logged in there). */
export async function openStreamingApp(platformId: string, link?: string | null) {
  const platform = getStreamingPlatform(platformId);
  const target = link?.trim() || platform.appOpenUrl;

  try {
    const supported = await Linking.canOpenURL(target);
    if (supported) {
      await Linking.openURL(target);
      return;
    }
  } catch {
    // Fall through to browser.
  }

  await WebBrowser.openBrowserAsync(target);
}
