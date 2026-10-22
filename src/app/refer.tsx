import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import { ReferPage } from '@/components/referral/ReferPage';

/**
 * Invite another couple (see ReferPage). Straight after onboarding's paywall
 * (?from=onboarding) there's nothing to go back to, so Back, Continue and Android's
 * back all go on to Home, and the swipe back is off.
 */
export default function ReferScreen() {
  const router = useRouter();
  const fromOnboarding = useLocalSearchParams<{ from?: string }>().from === 'onboarding';
  const toHome = () => router.replace('/(tabs)/home');

  useEffect(() => {
    if (!fromOnboarding) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/home');
      return true;
    });
    return () => sub.remove();
  }, [fromOnboarding, router]);

  return (
    <>
      {fromOnboarding ? <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} /> : null}
      <ReferPage onBack={fromOnboarding ? toHome : undefined} />
    </>
  );
}
