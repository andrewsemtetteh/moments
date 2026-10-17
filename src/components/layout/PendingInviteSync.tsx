import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';

import { getFirstName } from '@/lib/avatar-initial';
import { clearPendingInvite, getPendingInvite } from '@/lib/pending-links';
import { useRelationshipStore } from '@/stores';

/**
 * An invite link opened while already signed in (it used to be read only during
 * onboarding, so nothing happened): not paired yet, straight to joining with that code;
 * already connected, say so instead.
 */
export function PendingInviteSync() {
  useEffect(() => {
    const check = () => {
      void getPendingInvite().then(async (code) => {
        if (!code) return;
        const { partner } = useRelationshipStore.getState();
        if (partner) {
          await clearPendingInvite();
          Alert.alert(
            'You’re already connected',
            `You and ${getFirstName(partner.name) ?? 'your partner'} share a space. To join a different one, end this space in Settings first.`,
          );
          return;
        }
        // The join screen fills the code in (and uses it up).
        router.push('/(onboarding)/join-relationship');
      });
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, []);

  return null;
}
