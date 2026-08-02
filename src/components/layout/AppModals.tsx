import { Platform } from 'react-native';

import { MoodHistoryModal } from '@/components/home/MoodHistoryModal';
import { MomentCreatorModal } from '@/components/moments/MomentCreatorModal';
import { MomentHistoryModal } from '@/components/moments/MomentHistoryModal';
import { MomentRecapVideoModal } from '@/components/moments/MomentRecapVideoModal';
import { MomentStoryViewer } from '@/components/moments/MomentStoryViewer';
import { PaywallModal } from '@/components/subscription/PaywallModal';
import { StreakMilestoneModal } from '@/components/home/StreakMilestoneModal';
import { StreakSparkModal } from '@/components/home/StreakSparkModal';
import { WatchTogetherModal } from '@/components/watch/WatchTogetherModal';
import { WrappedModal } from '@/components/wrapped/WrappedModal';

/** Global overlays mounted once at the app root (native only). */
export function AppModals() {
  if (Platform.OS === 'web') return null;

  return (
    <>
      <MomentCreatorModal />
      <MomentHistoryModal />
      <MomentRecapVideoModal />
      <MomentStoryViewer />
      <WrappedModal />
      <MoodHistoryModal />
      <PaywallModal />
      <StreakMilestoneModal />
      <StreakSparkModal />
      <WatchTogetherModal />
    </>
  );
}
