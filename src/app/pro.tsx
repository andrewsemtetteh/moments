import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Platform, StyleSheet, View } from 'react-native';

import { ReferPage } from '@/components/referral/ReferPage';
import { PaywallScreen } from '@/components/subscription/PaywallScreen';
import { SuperwallPaywall } from '@/components/subscription/SuperwallPaywall';
import { BILLING_CONNECTED } from '@/constants/subscription';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
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
  const { colors } = useTheme();
  const { isPlus } = useSubscription();
  const markPaywallShownThisSession = useUIStore((s) => s.markPaywallShownThisSession);

  const isOnboarding = params.from === 'onboarding';
  const preview = params.preview === '1';

  /**
   * Onboarding is complete. Started Plus (or a trial): straight to Home. Closed it without
   * starting anything: the invite-a-couple page first, a free way to get Plus (both
   * couples get 14 days), then Home.
   */
  // The invite page, drawn right here in place of the paywall: no route change, so no blank
  // screen while one page goes and the next arrives.
  const [showRefer, setShowRefer] = useState(false);
  const done = useCallback(
    async (next: 'home' | 'refer' = 'home') => {
      if (!preview) {
        if (user) await markOnboardingPaywallDone(user.id);
        await markPaywallDismissed();
        markPaywallShownThisSession();
      }
      await finishOnboarding(user?.id, preview);
      if (next === 'home') router.replace('/(tabs)/home');
    },
    [user, preview, markPaywallShownThisSession, router],
  );
  const goHome = useCallback(() => router.replace('/(tabs)/home'), [router]);
  /** Closed without starting anything: the invite page straight away, the bookkeeping after. */
  const closeToRefer = () => {
    setShowRefer(true);
    void done('refer');
  };

  // On the invite page, Android's back goes on to Home (there's nothing behind it).
  useEffect(() => {
    if (!showRefer) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goHome();
      return true;
    });
    return () => sub.remove();
  }, [showRefer, goHome]);

  useEffect(() => {
    if (!isOnboarding || !isPlus || preview) return;
    void done();
  }, [isOnboarding, isPlus, preview, done]);

  // EXPO_PUBLIC_PAYWALL=superwall: the dashboard paywall; ours if it can't show.
  const trySuperwall = PAYWALL_SOURCE === 'superwall' && BILLING_CONNECTED && !preview && !isPlus;
  const [showNative, setShowNative] = useState(!trySuperwall);
  // The dashboard paywall is on screen: the invite page can wait underneath it (not before —
  // it would flash first).
  const [paywallUp, setPaywallUp] = useState(false);

  if (Platform.OS === 'web') return <Redirect href="/(tabs)/home" />;
  // Straight in (no fade): a fade showed the empty background behind it first.
  if (showRefer) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ReferPage onBack={goHome} />
      </View>
    );
  }
  if (isOnboarding && isPlus && !preview) return null;
  if (!showNative) {
    return (
      // Behind the dashboard paywall: in onboarding, the invite page itself (what comes next when
      // it's closed), so it's already there as the paywall slides away — no blank in between.
      // Otherwise the app's background (not black), for the moment it closes.
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {isOnboarding && !isPlus && paywallUp ? <ReferPage onBack={goHome} /> : null}
        <SuperwallPaywall
          onPresent={() => setPaywallUp(true)}
          placement={isOnboarding ? 'onboarding' : 'settings'}
          onDone={(outcome) => {
            if (outcome === 'unavailable') setShowNative(true);
            else if (isOnboarding && outcome === 'closed') closeToRefer();
            else if (isOnboarding) void done();
            else closeStackScreen(router);
          }}
        />
      </View>
    );
  }

  return (
    // In onboarding, the invite page waits underneath: the paywall slides down to it, no blank.
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isOnboarding && !isPlus ? (
        <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <ReferPage onBack={goHome} />
        </View>
      ) : null}
      <View style={StyleSheet.absoluteFill}>
    <PaywallScreen
      placement={isOnboarding ? 'onboarding' : 'settings'}
      // Free core: closing during onboarding just carries on with Free.
      showClose
      swipeToClose={false}
      // Closed without starting anything: the invite-a-couple page, then Home.
      onClose={() => (isOnboarding ? closeToRefer() : closeStackScreen(router))}
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
      </View>
    </View>
  );
}
