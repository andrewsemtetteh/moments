import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

import { useUIStore } from '@/stores';

export function useOpenPartnerProfile() {
  const openPartnerProfile = useUIStore((s) => s.openPartnerProfile);

  return useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openPartnerProfile();
  }, [openPartnerProfile]);
}
