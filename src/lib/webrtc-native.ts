import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

type WebRTCModule = typeof import('react-native-webrtc');

let cached: WebRTCModule | null | undefined;

/** react-native-webrtc needs a dev build — Expo Go can report a truthy NativeModules proxy even when unlinked. */
function hasNativeWebRTCModule() {
  if (Platform.OS === 'web') return false;
  if (Constants.executionEnvironment === 'storeClient') return false;
  return NativeModules.WebRTCModule != null;
}

export function getWebRTCModule(): WebRTCModule | null {
  if (cached !== undefined) return cached;

  if (!hasNativeWebRTCModule()) {
    cached = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay synchronous so callers can check availability without awaiting
    cached = require('react-native-webrtc') as WebRTCModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function isWebRTCAvailable() {
  return getWebRTCModule() != null;
}
