import { Modal, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PaywallScreen } from '@/components/subscription/PaywallScreen';
import { markPaywallDismissed } from '@/lib/paywall-storage';
import { useUIStore } from '@/stores';

export function PaywallModal() {
  const visible = useUIStore((s) => s.showPaywall);
  const closePaywall = useUIStore((s) => s.closePaywall);

  const handleClose = () => {
    void markPaywallDismissed();
    closePaywall();
  };

  if (!visible || Platform.OS === 'web') return null;

  return (
    // Transparent so swiping it down reveals the app behind, like Moments.
    <Modal visible transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={handleClose}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <PaywallScreen onClose={handleClose} showClose />
      </GestureHandlerRootView>
    </Modal>
  );
}
