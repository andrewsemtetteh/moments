import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { PaywallScreen } from '@/components/subscription/PaywallScreen';
import { useSubscription } from '@/hooks/useSubscription';
import { markOnboardingPaywallDone } from '@/lib/onboarding-storage';
import { markPaywallDismissed } from '@/lib/paywall-storage';
import { goBackOrReplace } from '@/lib/router';
import { useAuthStore, useUIStore } from '@/stores';

export default function ProScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; next?: string }>();
  const user = useAuthStore((s) => s.user);
  const { isPlus } = useSubscription();
  const markPaywallShownThisSession = useUIStore((s) => s.markPaywallShownThisSession);

  const isOnboarding = params.from === 'onboarding';
  const nextHref = params.next === 'welcome' ? '/(onboarding)/welcome' : '/(tabs)/home';

  const finishOnboarding = async () => {
    if (user) await markOnboardingPaywallDone(user.id);
    await markPaywallDismissed();
    markPaywallShownThisSession();
    router.replace(nextHref);
  };

  useEffect(() => {
    if (!isOnboarding || !isPlus) return;
    void finishOnboarding();
  }, [isOnboarding, isPlus]);

  if (Platform.OS === 'web') {
    return <Redirect href="/(tabs)/home" />;
  }

  if (isOnboarding && isPlus) {
    return null;
  }

  return (
    <PaywallScreen
      showClose
      onClose={() => {
        if (isOnboarding) {
          void finishOnboarding();
          return;
        }
        goBackOrReplace(router, '/(tabs)/home');
      }}
    />
  );
}
