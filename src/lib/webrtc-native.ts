type WebRTCModule = typeof import('react-native-webrtc');

let cached: WebRTCModule | null | undefined;

export function getWebRTCModule(): WebRTCModule | null {
  if (cached !== undefined) return cached;
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
