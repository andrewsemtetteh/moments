import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoHaptics from 'expo-haptics';
import { create } from 'zustand';

/**
 * Drop-in for `expo-haptics` that respects the Haptics switch in Settings.
 * Import it as `import * as Haptics from '@/lib/haptics'`.
 */
export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';

const KEY = 'pref:haptics-enabled';

type HapticsPrefState = { enabled: boolean; setEnabled: (enabled: boolean) => void };

export const useHapticsPref = create<HapticsPrefState>((set) => ({
  enabled: true,
  setEnabled: (enabled) => {
    set({ enabled });
    void AsyncStorage.setItem(KEY, enabled ? '1' : '0').catch(() => undefined);
  },
}));

void AsyncStorage.getItem(KEY)
  .then((value) => {
    if (value === '0') useHapticsPref.setState({ enabled: false });
  })
  .catch(() => undefined);

const on = () => useHapticsPref.getState().enabled;

export function impactAsync(style?: ExpoHaptics.ImpactFeedbackStyle): Promise<void> {
  return on() ? ExpoHaptics.impactAsync(style) : Promise.resolve();
}

export function notificationAsync(type?: ExpoHaptics.NotificationFeedbackType): Promise<void> {
  return on() ? ExpoHaptics.notificationAsync(type) : Promise.resolve();
}

export function selectionAsync(): Promise<void> {
  return on() ? ExpoHaptics.selectionAsync() : Promise.resolve();
}
