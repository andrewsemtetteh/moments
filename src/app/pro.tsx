import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { PaywallScreen } from '@/components/subscription/PaywallScreen';
import { SuperwallPaywall } from '@/components/subscription/SuperwallPaywall';
import { BILLING_CONNECTED } from '@/constants/subscription';
import { useSubscription } from '@/hooks/useSubscription';
import { finishOnboarding } from '@/lib/onboarding-v2';
import { markOnboardingPaywallDone } from '@/lib/onboarding-storage';
import { markPaywallDismissed } from '@/lib/paywall-storage';
import { PAYWALL_SOURCE } from '@/lib/purchases';
import { closeStackScreen } from '@/lib/router';
import { useAuthStore, useUIStore } from '@/stores';

/**
 * The last onboarding step. Hybrid pricing: the core app is free, so this
 * can be closed (you carry on with Free); Plus is offered again when a free
 * limit is hit (requirePlus). Someone whose space already has Plus (their
 * partner pays) skips straight past it. Then Home, where the tour starts.
 */
export default function ProScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; next?: string; preview?: string }>();
  const user = useAuthStore((s) => s.user);
  const { isPlus } = useSubscription();
  const markPaywallShownThisSession = useUIStore((s) => s.markPaywallShownThisSession);

  const isOnboarding = params.from === 'onboarding';
  const preview = params.preview === '1';

  const done = useCallback(async () => {
    if (!preview) {
      if (user) await markOnboardingPaywallDone(user.id);
      await markPaywallDismissed();
      markPaywallShownThisSession();
    }
    await finishOnboarding(user?.id, preview);
    router.replace('/(tabs)/home');
  }, [user, preview, markPaywallShownThisSession, router]);

  useEffect(() => {
    if (!isOnboarding || !isPlus || preview) return;
    void done();
  }, [isOnboarding, isPlus, preview, done]);

  // EXPO_PUBLIC_PAYWALL=superwall: the dashboard paywall; ours if it can't show.
  const trySuperwall = PAYWALL_SOURCE === 'superwall' && BILLING_CONNECTED && !preview && !isPlus;
  const [showNative, setShowNative] = useState(!trySuperwall);

  if (Platform.OS === 'web') return <Redirect href="/(tabs)/home" />;
  if (isOnboarding && isPlus && !preview) return null;
  if (!showNative) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <SuperwallPaywall
          placement={isOnboarding ? 'onboarding' : 'settings'}
          onDone={(outcome) => {
            if (outcome === 'unavailable') setShowNative(true);
            else if (isOnboarding) void done();
            else closeStackScreen(router);
          }}
        />
      </View>
    );
  }

  return (
    <PaywallScreen
      placement={isOnboarding ? 'onboarding' : 'settings'}
      // Free core: closing during onboarding just carries on with Free.
      showClose
      swipeToClose={false}
      onClose={() => (isOnboarding ? void done() : closeStackScreen(router))}
      onRefer={() => router.push({ pathname: '/refer', params: preview ? { preview: '1' } : undefined })}
      onOpenLegal={(doc) => router.push(doc === 'terms' ? '/legal/terms' : '/legal/privacy')}
      // Bought (or restored): onboarding finishes; otherwise just close.
      onPurchased={() => (isOnboarding ? void done() : closeStackScreen(router))}
      onSubscribe={
        !BILLING_CONNECTED || preview
          ? async () => {
              // No purchases yet (or the preview): don't lock anyone out of the app.
              if (isOnboarding) await done();
              else Alert.alert('Coming soon', 'Moments Plus will be available soon.');
            }
          : undefined
      }
    />
  );
}
