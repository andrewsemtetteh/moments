import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { useTheme } from '@/hooks/useTheme';
import { createSessionFromUrl, isRecoveryCallbackUrl } from '@/lib/oauth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  useEffect(() => {
    let cancelled = false;

    async function finishAuth() {
      try {
        const initialUrl = await Linking.getInitialURL();
        const query = new URLSearchParams(
          Object.entries(params).flatMap(([key, value]) =>
            value == null ? [] : [[key, String(value)]],
          ),
        ).toString();

        const url =
          initialUrl ??
          (query.length > 0 ? Linking.createURL(`auth/callback?${query}`) : Linking.createURL('auth/callback'));

        const isRecovery =
          params.type === 'recovery' ||
          (typeof initialUrl === 'string' && isRecoveryCallbackUrl(initialUrl)) ||
          isRecoveryCallbackUrl(url);

        await createSessionFromUrl(url);
        if (!cancelled) {
          router.replace(isRecovery ? '/(auth)/reset-password' : '/');
        }
      } catch {
        if (!cancelled) router.replace('/(auth)/login');
      }
    }

    finishAuth();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
