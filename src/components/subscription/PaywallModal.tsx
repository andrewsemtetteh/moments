import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PaywallScreen } from '@/components/subscription/PaywallScreen';
import { SuperwallPaywall, type SuperwallPaywallOutcome } from '@/components/subscription/SuperwallPaywall';
import { markPaywallDismissed } from '@/lib/paywall-storage';
import { BILLING_AVAILABLE, PAYWALL_SOURCE } from '@/lib/purchases';
import { useUIStore } from '@/stores';

const USE_SUPERWALL = PAYWALL_SOURCE === 'superwall' && BILLING_AVAILABLE;

/**
 * The in-app paywall. Ours (PaywallScreen) by default; with EXPO_PUBLIC_PAYWALL=superwall it shows
 * the paywall designed in the Superwall dashboard, falling back to ours when none is shown.
 */
export function PaywallModal() {
  const visible = useUIStore((s) => s.showPaywall);
  const closePaywall = useUIStore((s) => s.closePaywall);
  const reason = useUIStore((s) => s.paywallReason);
  const headline = useUIStore((s) => s.paywallHeadline);
  const offer = useUIStore((s) => s.paywallOffer);
  // Superwall's paywall couldn't be shown this time: show ours.
  const [useNative, setUseNative] = useState(!USE_SUPERWALL);
  const placement = offer ?? (reason ? 'limit' : headline ? 'moment' : 'reminder');

  const handleClose = () => {
    void markPaywallDismissed();
    closePaywall();
  };

  // Each opening tries Superwall again.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setUseNative(!USE_SUPERWALL);
  }

  const onSuperwallDone = (outcome: SuperwallPaywallOutcome) => {
    if (outcome === 'unavailable') {
      setUseNative(true);
      return;
    }
    if (outcome === 'closed') void markPaywallDismissed();
    closePaywall();
  };

  if (!visible || Platform.OS === 'web') return null;
  if (!useNative) {
    return (
      <SuperwallPaywall
        placement={placement}
        params={{ feature: typeof reason === 'string' ? reason : '', headline: headline ?? '' }}
        onDone={onSuperwallDone}
      />
    );
  }

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
          placement={placement}
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
