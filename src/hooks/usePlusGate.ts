import { useSubscription } from '@/hooks/useSubscription';
import { useUIStore } from '@/stores';

export function usePlusGate() {
  const { isPlus } = useSubscription();
  const openPaywall = useUIStore((s) => s.openPaywall);

  const requirePlus = (_featureLabel?: string, onAllowed?: () => void): boolean => {
    if (isPlus) {
      onAllowed?.();
      return true;
    }
    openPaywall();
    return false;
  };

  return { isPlus, requirePlus, openPaywall };
}
