import { callManager } from '@/lib/call-manager';
import { useCallStore, useUIStore } from '@/stores';

/**
 * Signed out (or the session ended, or the account was deleted): nothing of that account
 * stays on screen. A call in progress ends (and stops ringing on the other phone), and every
 * overlay closes: celebrations, the birthday and rating pages, Moments, the partner's
 * profile, the paywall, developer previews.
 */
export function clearSessionUi() {
  const call = useCallStore.getState();
  if (call.phase !== 'idle') {
    if (!call.callId?.startsWith('preview-')) void callManager.endCall().catch(() => undefined);
    call.reset();
  }

  useUIStore.setState({
    birthdayCelebration: null,
    showRatingPage: false,
    streakSpark: null,
    streakMilestoneCount: null,
    togetherMilestoneCount: null,
    trophyView: null,
    showPaywall: false,
    showMomentCreator: false,
    showMomentHistory: false,
    momentViewer: null,
    showPartnerProfile: false,
    partnerLocationMap: null,
    showWrapped: false,
    showMoodHistory: false,
    devPreview: false,
    authPreview: false,
  });
}
