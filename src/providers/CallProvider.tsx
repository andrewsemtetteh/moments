import { useEffect } from 'react';
import { Platform } from 'react-native';

import { CallOverlay } from '@/components/call/CallOverlay';
import { callManager } from '@/lib/call-manager';
import { useAuthStore, useCallStore, useRelationshipStore } from '@/stores';

export function CallProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const phase = useCallStore((s) => s.phase);
  const setIncoming = useCallStore((s) => s.setIncoming);
  const setPhase = useCallStore((s) => s.setPhase);
  const setError = useCallStore((s) => s.setError);
  const reset = useCallStore((s) => s.reset);

  useEffect(() => {
    if (Platform.OS === 'web' || !relationship?.id || !user?.id) return;

    callManager.setCallbacks({
      onInvite: (signal) => {
        if (phase !== 'idle') return;
        setIncoming({
          callId: signal.callId,
          mode: signal.mode,
          partnerName: signal.fromName,
        });
      },
      onPhase: (next) => {
        if (next === 'active') setPhase('active');
        if (next === 'ended') reset();
      },
      onError: (message) => setError(message),
    });

    void callManager.attachChannel(relationship.id, user.id, user.name ?? 'You');

    return () => {
      void callManager.detachChannel();
    };
  }, [phase, relationship?.id, reset, setError, setIncoming, setPhase, user?.id, user?.name]);

  return (
    <>
      {children}
      <CallOverlay />
    </>
  );
}
