import { Modal } from 'react-native';

import { MomentCreatorModal } from '@/components/moments/MomentCreatorModal';
import { MomentHistoryModal } from '@/components/moments/MomentHistoryModal';
import { MomentRecapVideoModal } from '@/components/moments/MomentRecapVideoModal';
import { MomentStoryViewer } from '@/components/moments/MomentStoryViewer';
import { useUIStore } from '@/stores';

/**
 * A native fullscreen Modal can't cleanly layer a second one on top — presenting/dismissing
 * two in a row causes a visible flash of whatever screen sits underneath both (e.g. Home,
 * for a frame, while opening a moment from History). Camera, History, the story viewer, and
 * the recap video all share this single Modal instance instead, so switching between them is
 * a plain re-render, never a native modal teardown/rebuild.
 */
export function MomentsModal() {
  const showCreator = useUIStore((s) => s.showMomentCreator);
  const showHistory = useUIStore((s) => s.showMomentHistory);
  const viewer = useUIStore((s) => s.momentViewer);
  const showRecap = useUIStore((s) => s.showMomentRecapVideo);
  const visible = showCreator || showHistory || !!viewer || showRecap;

  if (!visible) return null;

  // Only animate the entrance when nothing else in this shared Modal was already
  // showing — a swap between Creator/History/Viewer/Recap while it's mounted should never animate.
  const enterAnimation = showCreator || showHistory ? 'none' : 'fade';

  return (
    <Modal visible animationType={enterAnimation} presentationStyle="fullScreen" onRequestClose={() => {}}>
      {viewer ? (
        <MomentStoryViewer />
      ) : showRecap ? (
        <MomentRecapVideoModal />
      ) : (
        <>
          {showCreator && <MomentCreatorModal />}
          {showHistory && <MomentHistoryModal />}
        </>
      )}
    </Modal>
  );
}
