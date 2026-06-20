import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { LogoMark } from '@/components/ui/Logo';
import { ScreenBackground } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { isAvatarPromptDone, isRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import { useAuthStore, useRelationshipStore } from '@/stores';

export default function IndexScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const isLoading = useAuthStore((s) => s.isLoading);
  const session = useAuthStore((s) => s.session);
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
    ]).start();
  }, [fade, scale]);

  useEffect(() => {
    if (isLoading) return;

    let cancelled = false;

    async function route() {
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;

      if (!session) {
        router.replace('/(auth)/login');
        return;
      }
      if (!relationship) {
        if (user && !user.avatar_url && !(await isAvatarPromptDone(user.id))) {
          router.replace('/(onboarding)/profile-setup');
        } else if (user && (await isRelationshipOnboardingDone(user.id))) {
          router.replace({
            pathname: '/(onboarding)/create-relationship',
            params: { anniversarySkipped: '1' },
          });
        } else {
          router.replace('/(onboarding)/anniversary-setup');
        }
        return;
      }
      if (relationship.status === 'pending' && !relationship.user_2_id) {
        router.replace('/(tabs)/home');
        return;
      }
      if (relationship.status === 'pending') {
        router.replace('/(onboarding)/welcome');
        return;
      }
      router.replace('/(tabs)/home');
    }

    route();

    return () => {
      cancelled = true;
    };
  }, [isLoading, session, relationship, user, router]);

  return (
    <ScreenBackground>
      <View style={styles.center}>
        <Animated.View style={{ opacity: fade, transform: [{ scale }], alignItems: 'center' }}>
          <LogoMark size={84} />
          <Text style={[styles.wordmark, { color: colors.text }]}>Moments</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>Closer, every day</Text>
        </Animated.View>
      </View>
      <View style={styles.loader}>
        <ActivityIndicator color={colors.accent} />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 16 },
  tagline: { fontSize: 15, marginTop: 6, letterSpacing: 0.3 },
  loader: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center' },
});
