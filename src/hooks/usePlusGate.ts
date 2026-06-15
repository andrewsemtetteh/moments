import { Alert } from 'react-native';

import { useSubscription } from '@/hooks/useSubscription';
import { useUIStore } from '@/stores';

export function usePlusGate() {
  const { isPlus } = useSubscription();
  const openPaywall = useUIStore((s) => s.openPaywall);

  const requirePlus = (featureLabel: string, onAllowed?: () => void): boolean => {
    if (isPlus) {
      onAllowed?.();
      return true;
    }
    Alert.alert(
      'Moments Plus',
      `${featureLabel} is included with Moments Plus — one subscription covers both of you.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'View Plus', onPress: openPaywall },
      ],
    );
    return false;
  };

  return { isPlus, requirePlus, openPaywall };
}
