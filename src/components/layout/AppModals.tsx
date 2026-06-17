import { Platform } from 'react-native';

import { MoodHistoryModal } from '@/components/home/MoodHistoryModal';
import { MomentCreatorModal } from '@/components/moments/MomentCreatorModal';
import { MomentHistoryModal } from '@/components/moments/MomentHistoryModal';
import { MomentStoryViewer } from '@/components/moments/MomentStoryViewer';
import { PaywallModal } from '@/components/subscription/PaywallModal';
import { WrappedModal } from '@/components/wrapped/WrappedModal';

/** Global overlays mounted once at the app root (native only). */
export function AppModals() {
  if (Platform.OS === 'web') return null;

  return (
    <>
      <MomentCreatorModal />
      <MomentHistoryModal />
      <MomentStoryViewer />
      <WrappedModal />
      <MoodHistoryModal />
      <PaywallModal />
    </>
  );
}
