import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/ui/Logo';
import { ScreenBackground } from '@/components/ui/primitives';
import { isIntroCompleted } from '@/lib/intro-storage';
import { isAvatarPromptDone, isNotificationPromptDone, isOnboardingPaywallDone, isRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import { needsProfileSetup, profileSetupEntryRoute } from '@/lib/profile-setup';
import { useAuthStore, useRelationshipStore } from '@/stores';

export default function IndexScreen() {
  const router = useRouter();
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
      if (cancelled) return;

      if (!session) {
        const hasUsedAuthBefore = await isIntroCompleted();
        router.replace(hasUsedAuthBefore ? '/(auth)/login' : '/(auth)/welcome');
        return;
      }
      if (!relationship) {
        if (user && needsProfileSetup(user, await isAvatarPromptDone(user.id))) {
          router.replace(profileSetupEntryRoute(user, await isAvatarPromptDone(user.id)) as never);
        } else if (user && (await isRelationshipOnboardingDone(user.id))) {
          router.replace({
            pathname: '/(onboarding)/relationship-path',
            params: { anniversarySkipped: '1', relationshipTypeSkipped: '1' },
          });
        } else {
          router.replace('/(onboarding)/anniversary-setup');
        }
        return;
      }
      if (relationship.status === 'pending' && !relationship.user_2_id) {
        if (user && !(await isNotificationPromptDone(user.id))) {
          router.replace({
            pathname: '/(onboarding)/notification-prompt',
            params: { next: 'home' },
          });
        } else if (user && !(await isOnboardingPaywallDone(user.id))) {
          router.replace({
            pathname: '/pro',
            params: { from: 'onboarding', next: 'home' },
          });
        } else {
          router.replace('/(tabs)/home');
        }
        return;
      }
      if (relationship.status === 'pending') {
        if (user && !(await isNotificationPromptDone(user.id))) {
          router.replace({
            pathname: '/(onboarding)/notification-prompt',
            params: { next: 'welcome' },
          });
        } else if (user && !(await isOnboardingPaywallDone(user.id))) {
          router.replace({
            pathname: '/pro',
            params: { from: 'onboarding', next: 'welcome' },
          });
        } else {
          router.replace('/(onboarding)/welcome');
        }
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
          <LogoMark size={160} />
          {/* <Text style={[styles.wordmark, { color: colors.text }]}>Moments</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>Closer, every day</Text> */}
        </Animated.View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // wordmark: { fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 16 },
  // tagline: { fontSize: 15, marginTop: 6, letterSpacing: 0.3 },
});
