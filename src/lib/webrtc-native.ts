import { NativeModules } from 'react-native';

type WebRTCModule = typeof import('react-native-webrtc');

let cached: WebRTCModule | null | undefined;

function hasNativeWebRTCModule() {
  return NativeModules.WebRTCModule != null;
}

export function getWebRTCModule(): WebRTCModule | null {
  if (cached !== undefined) return cached;

  if (!hasNativeWebRTCModule()) {
    cached = null;
    return null;
  }

  try {
    cached = require('react-native-webrtc') as WebRTCModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function isWebRTCAvailable() {
  return getWebRTCModule() != null;
}
