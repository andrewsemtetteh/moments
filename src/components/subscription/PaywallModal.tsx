import { Modal, Platform } from 'react-native';

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
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <PaywallScreen onClose={handleClose} showClose />
    </Modal>
  );
}
