import { Alert } from 'react-native';

import { callManager } from '@/lib/call-manager';
import type { CallMode } from '@/lib/call-types';
import { getFirstName } from '@/lib/avatar-initial';
import { isWebRTCAvailable } from '@/lib/webrtc-native';
import { sendPartnerNotification } from '@/services/api';
import { useAuthStore, useCallStore, useRelationshipStore } from '@/stores';

export function useStartCall() {
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const setPhase = useCallStore((s) => s.setPhase);
  const setMode = useCallStore((s) => s.setMode);
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
      // Their app may be closed: a call push brings them in while it's still ringing.
      const relationshipId = useRelationshipStore.getState().relationship?.id;
      if (relationshipId) {
        void sendPartnerNotification(
          relationshipId,
          partner.id,
          'call',
          `${getFirstName(user.name) ?? 'Your partner'} is ${mode === 'video' ? 'video ' : ''}calling you. Tap to answer.`,
        ).catch(() => undefined);
      }
    } catch (e) {
      reset();
      Alert.alert('Call failed', e instanceof Error ? e.message : 'Please try again');
    }
  };
}
