import { useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PaywallScreen } from '@/components/subscription/PaywallScreen';
import { SuperwallPaywall, type SuperwallPaywallOutcome } from '@/components/subscription/SuperwallPaywall';
import { markPaywallDismissed } from '@/lib/paywall-storage';
import { BILLING_AVAILABLE, PAYWALL_SOURCE } from '@/lib/purchases';
import { MOMENTS_BACK, useMomentsBack } from '@/lib/moments-back';
import { useUIStore } from '@/stores';

const USE_SUPERWALL = PAYWALL_SOURCE === 'superwall' && BILLING_AVAILABLE;

/**
 * The in-app paywall. Ours (PaywallScreen) by default; with EXPO_PUBLIC_PAYWALL=superwall it shows
 * the paywall designed in the Superwall dashboard, falling back to ours when none is shown.
 */
export function PaywallModal({ inline = false }: { inline?: boolean } = {}) {
  const visible = useUIStore((s) => s.showPaywall);
  // While Moments (camera / history / viewer) is up it owns the screen on iPhone, and a
  // second full-screen layer can't open over it — so Moments draws the paywall inside
  // itself (`inline`) and the app-level one stays out of the way.
  const momentsOpen = useUIStore((s) => s.showMomentCreator || s.showMomentHistory || !!s.momentViewer);
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

  // Android back inside Moments closes the paywall drawn there.
  useMomentsBack(MOMENTS_BACK.paywall, inline && visible && momentsOpen, handleClose);

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
  if (inline !== momentsOpen) return null;

  if (!useNative) {
    return (
      <SuperwallPaywall
        placement={placement}
        params={{ feature: typeof reason === 'string' ? reason : '', headline: headline ?? '' }}
        onDone={onSuperwallDone}
      />
    );
  }

  const content = (
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <PaywallScreen
          onClose={handleClose}
          onPurchased={closePaywall}
          reason={reason}
          headline={headline}
          offer={offer}
          placement={placement}
          showClose
        />
      </GestureHandlerRootView>
  );

  if (inline) return <View style={StyleSheet.absoluteFill}>{content}</View>;

  return (
    // Slides up over the app; closes only from its close button (not draggable).
    <Modal visible transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={handleClose}>
      {content}
    </Modal>
  );
}
