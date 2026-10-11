import { Platform } from 'react-native';

import { GameRoomBridge } from '@/components/games/GameRoomBridge';
import { MoodHistoryModal } from '@/components/home/MoodHistoryModal';
import { MomentsModal } from '@/components/moments/MomentsModal';
import { FullScreenLocationMapModal } from '@/components/profile/FullScreenLocationMapModal';
import { PaywallModal } from '@/components/subscription/PaywallModal';
import { StreakMilestoneModal } from '@/components/home/StreakMilestoneModal';
import { StreakSparkModal } from '@/components/home/StreakSparkModal';
import { WrappedModal } from '@/components/wrapped/WrappedModal';
import { useUIStore } from '@/stores';

/**
 * Full-screen shared-location viewer, opened from the partner profile sheet. The profile
 * closes itself first (see `leaveProfile` in PartnerProfileModal) before this opens, so this
 * is always the only Modal in play — it presents as a true, edge-to-edge full-screen modal
 * rather than being confined to the profile sheet's smaller, rounded-corner bounds. Closing
 * it reopens the profile the same way, one settle-tick apart, never simultaneously.
 */
function PartnerLocationMapModal() {
  const partnerLocationMap = useUIStore((s) => s.partnerLocationMap);
  const closePartnerLocationMap = useUIStore((s) => s.closePartnerLocationMap);
  const openPartnerProfile = useUIStore((s) => s.openPartnerProfile);

  const handleClose = () => {
    closePartnerLocationMap();
    setTimeout(openPartnerProfile, 0);
  };

  return (
    <FullScreenLocationMapModal
      visible={!!partnerLocationMap}
      markers={partnerLocationMap?.markers ?? []}
      title={partnerLocationMap?.title}
      onClose={handleClose}
    />
  );
}

/** Global overlays mounted once at the app root (native only). */
export function AppModals() {
  if (Platform.OS === 'web') return null;

  return (
    <>
      <MomentsModal />
      <PartnerLocationMapModal />
      <WrappedModal />
      <MoodHistoryModal />
      <PaywallModal />
      <StreakMilestoneModal />
      <StreakSparkModal />
      <GameRoomBridge />
    </>
  );
}
