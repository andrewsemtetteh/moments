import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = require('./app.json').expo;

  return {
    ...base,
    extra: {
      ...base.extra,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.EXPO_PUBLIC_SUPABASE_KEY,
    },
  };
};
