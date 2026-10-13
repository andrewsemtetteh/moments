import { useSubscription } from '@/hooks/useSubscription';
import { useUIStore } from '@/stores';

export function usePlusGate() {
  const { isPlus } = useSubscription();
  const openPaywall = useUIStore((s) => s.openPaywall);

  /** Runs `onAllowed` on Plus; otherwise opens the paywall headed with the feature that was hit. */
  const requirePlus = (featureLabel?: string, onAllowed?: () => void): boolean => {
    if (isPlus) {
      onAllowed?.();
      return true;
    }
    openPaywall(featureLabel);
    return false;
  };

  return { isPlus, requirePlus, openPaywall };
}
