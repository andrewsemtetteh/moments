import { Modal, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { MomentCreatorModal } from '@/components/moments/MomentCreatorModal';
import { MomentFocusViewer } from '@/components/moments/MomentFocusViewer';
import { MomentHistoryModal } from '@/components/moments/MomentHistoryModal';
import { MomentStoryViewer } from '@/components/moments/MomentStoryViewer';
import { useUIStore } from '@/stores';
import { ThemedStatusBar } from '@/components/ui/ThemedStatusBar';
import { PaywallModal } from '@/components/subscription/PaywallModal';
import { handleMomentsBack } from '@/lib/moments-back';
import { ChoiceSheetHost } from '@/components/ui/ChoiceSheet';

/**
 * A native fullscreen Modal can't cleanly layer a second one on top — presenting/dismissing
 * two in a row causes a visible flash of whatever screen sits underneath both (e.g. Home,
 * for a frame, while opening a moment from History). Camera, History and the story viewer
 * all share this single Modal instance instead, so switching between them is
 * a plain re-render, never a native modal teardown/rebuild.
 */
export function MomentsModal() {
  const showCreator = useUIStore((s) => s.showMomentCreator);
  const showHistory = useUIStore((s) => s.showMomentHistory);
  const viewer = useUIStore((s) => s.momentViewer);
  const visible = showCreator || showHistory || !!viewer;

  if (!visible) return null;

  // Only animate the entrance when nothing else in this shared Modal was already
  // showing — a swap between Creator/History/Viewer while it's mounted should never animate.
  const enterAnimation = showCreator || showHistory ? 'none' : 'fade';
  // Light icons only over an opened photo/video (always dark). The camera page, History,
  // albums and the map all sit on the theme's background, so they follow the theme —
  // otherwise a light theme got white-on-white icons and the status bar looked covered.
  // (The camera can stay mounted underneath History, so it mustn't decide this.)
  const overMedia = !!viewer;

  // `transparent` (over full screen): every child paints its own opaque
  // background, so this looks identical — but while History is swiped away
  // the app underneath shows through instead of a blank window.
  // GestureHandlerRootView: a native Modal is its own root, so gestures
  // inside it (History's swipe-to-close) need their own on Android.
  return (
    <Modal
      visible
      transparent
      animationType={enterAnimation}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      // Android's back key comes here, not to BackHandler: hand it to the top layer.
      onRequestClose={handleMomentsBack}>
      <ThemedStatusBar style={overMedia ? 'light' : undefined} />
      <GestureHandlerRootView style={styles.root}>
        {/* Camera and History stay drawn under an open moment when that's where it came
            from, so closing or swiping the moment away reveals them, never Home. */}
        {showCreator && !viewer ? <MomentCreatorModal /> : null}
        {showHistory || viewer?.returnToHistory ? (
          <View style={StyleSheet.absoluteFill} pointerEvents={viewer ? 'none' : 'auto'}>
            <MomentHistoryModal />
          </View>
        ) : null}
        {viewer ? (
          <View style={StyleSheet.absoluteFill}>
            {/* Opened from Our moments or a chat reply: the full-screen photo viewer. Stories keep theirs. */}
            {viewer.playback === 'focus' ? <MomentFocusViewer /> : <MomentStoryViewer />}
          </View>
        ) : null}
        {/* Moments+ opened from in here (e.g. the album limit): on top, closing it lands back here. */}
        <PaywallModal inline />
        {/* Choices asked from inside Moments ("Delete moment?") show over it. */}
        <ChoiceSheetHost inline />
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
