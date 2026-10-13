import { router } from 'expo-router';
import { Modal, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PaywallScreen } from '@/components/subscription/PaywallScreen';
import { markPaywallDismissed } from '@/lib/paywall-storage';
import { useUIStore } from '@/stores';

export function PaywallModal() {
  const visible = useUIStore((s) => s.showPaywall);
  const closePaywall = useUIStore((s) => s.closePaywall);
  const reason = useUIStore((s) => s.paywallReason);
  const headline = useUIStore((s) => s.paywallHeadline);
  const offer = useUIStore((s) => s.paywallOffer);

  const handleClose = () => {
    void markPaywallDismissed();
    closePaywall();
  };

  if (!visible || Platform.OS === 'web') return null;

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
