import { Alert } from 'react-native';

import { callManager } from '@/lib/call-manager';
import type { CallMode } from '@/lib/call-types';
import { isWebRTCAvailable } from '@/lib/webrtc-native';
import { useAuthStore, useCallStore, useRelationshipStore } from '@/stores';

export function useStartCall() {
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const setPhase = useCallStore((s) => s.setPhase);
  const setMode = useCallStore((s) => s.setMode);
  const setCallId = useCallStore((s) => s.setCallId);
  const setPartnerName = useCallStore((s) => s.setPartnerName);
  const setError = useCallStore((s) => s.setError);
  const reset = useCallStore((s) => s.reset);

  return async (mode: CallMode) => {
    if (!user || !partner) {
      Alert.alert('Unavailable', 'Connect with your partner before starting a call.');
      return;
    }

    if (!isWebRTCAvailable()) {
      Alert.alert(
        'Development build required',
        'Audio and video calls use WebRTC and require a dev build. Run npx expo run:android or run:ios.',
      );
      return;
    }

    try {
      setMode(mode);
      setPartnerName(partner.name ?? 'Partner');
      setPhase('outgoing');
      setError(null);
      await callManager.startCall(mode);
    } catch (e) {
      reset();
      Alert.alert('Call failed', e instanceof Error ? e.message : 'Please try again');
    }
  };
}
