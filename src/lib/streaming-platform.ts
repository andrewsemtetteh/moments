import * as WebBrowser from 'expo-web-browser';

import { getStreamingPlatform } from '@/constants/streaming-platforms';

export async function openStreamingSignIn(platformId: string) {
  const platform = getStreamingPlatform(platformId);
  await WebBrowser.openBrowserAsync(platform.signInUrl);
}
