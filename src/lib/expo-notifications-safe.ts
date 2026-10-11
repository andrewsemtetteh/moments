import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type ExpoNotificationsModule = typeof import('expo-notifications');

/** Expo Go (SDK 53+) throws at import time — remote/local push APIs need a dev build. */
export function isExpoNotificationsSupported(): boolean {
  if (Platform.OS === 'web') return false;
  return Constants.executionEnvironment !== 'storeClient';
}

export function loadExpoNotifications(): ExpoNotificationsModule | null {
  if (!isExpoNotificationsSupported()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay synchronous so callers can check availability without awaiting
    return require('expo-notifications') as ExpoNotificationsModule;
  } catch {
    return null;
  }
}
