import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

type SupabaseExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const isBrowser = typeof window !== 'undefined';

const extra = (Constants.expoConfig?.extra ?? {}) as SupabaseExtra;

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '';

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  extra.supabaseAnonKey ??
  '';

const noopStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

function getAuthStorage() {
  if (!isBrowser) return noopStorage;
  if (Platform.OS === 'web') return AsyncStorage;
  return ExpoSecureStoreAdapter;
}

function createSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[Moments] Missing Supabase env vars. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart: npx expo start -c',
    );
  }

  return createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      auth: {
        storage: getAuthStorage(),
        autoRefreshToken: isBrowser,
        persistSession: isBrowser,
        detectSessionInUrl: Platform.OS === 'web' && isBrowser,
      },
    },
  );
}

/** Lazy client — avoids SSR `window is not defined` on web static render. */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createSupabaseClient();
  }
  return client;
}

/** @deprecated Prefer getSupabase() — kept for existing imports */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabase(), prop);
  },
});

export const isSupabaseConfigured =
  supabaseUrl.length > 0 &&
  supabaseAnonKey.length > 0 &&
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('placeholder');

export const isNativeApp = Platform.OS !== 'web';
