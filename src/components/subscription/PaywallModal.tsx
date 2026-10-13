import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PaywallScreen } from '@/components/subscription/PaywallScreen';
import { markPaywallDismissed } from '@/lib/paywall-storage';
import { PAYWALL_SOURCE, presentRevenueCatPaywall, WINBACK_OFFERING } from '@/lib/purchases';
import { useUIStore } from '@/stores';

/**
 * The in-app paywall. Ours (PaywallScreen) by default; with EXPO_PUBLIC_PAYWALL=revenuecat it shows
 * the paywall designed in the RevenueCat dashboard, falling back to ours when none is set up.
 */
export function PaywallModal() {
  const visible = useUIStore((s) => s.showPaywall);
  const closePaywall = useUIStore((s) => s.closePaywall);
  const reason = useUIStore((s) => s.paywallReason);
  const headline = useUIStore((s) => s.paywallHeadline);
  const offer = useUIStore((s) => s.paywallOffer);
  // RevenueCat's paywall couldn't be shown this time: show ours.
  const [useNative, setUseNative] = useState(PAYWALL_SOURCE === 'native');

  const handleClose = () => {
    void markPaywallDismissed();
    closePaywall();
  };

  useEffect(() => {
    if (!visible || PAYWALL_SOURCE !== 'revenuecat' || Platform.OS === 'web') return;
    let cancelled = false;
    void presentRevenueCatPaywall(offer === 'winback' ? WINBACK_OFFERING : undefined).then((outcome) => {
      if (cancelled) return;
      if (outcome === 'unavailable') {
        setUseNative(true);
        return;
      }
      if (outcome === 'closed') void markPaywallDismissed();
      closePaywall();
    });
    return () => {
      cancelled = true;
      setUseNative(PAYWALL_SOURCE === 'native');
    };
  }, [visible, offer, closePaywall]);

  if (!visible || Platform.OS === 'web' || !useNative) return null;

  return (
    // Transparent so swiping it down reveals the app behind, like Moments.
    <Modal visible transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={handleClose}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <PaywallScreen
          onClose={handleClose}
          onPurchased={closePaywall}
          reason={reason}
          headline={headline}
          offer={offer}
          placement={offer ?? (reason ? 'limit' : headline ? 'moment' : 'reminder')}
          showClose
          // Leaving the overlay for a page: close it, then open the page.
          onRefer={() => {
            closePaywall();
            setTimeout(() => router.push('/refer'), 250);
          }}
          onOpenLegal={(doc) => {
            closePaywall();
            setTimeout(() => router.push(doc === 'terms' ? '/legal/terms' : '/legal/privacy'), 250);
          }}
        />
      </GestureHandlerRootView>
    </Modal>
  );
}
