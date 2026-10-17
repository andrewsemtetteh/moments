import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const noSubscribe = () => () => undefined;

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web:
 * the server render (and the first client render, to match it) is 'light', then the real scheme.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const colorScheme = useRNColorScheme();
  return hasHydrated ? colorScheme : 'light';
}
