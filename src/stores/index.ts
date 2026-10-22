import { create } from 'zustand';

import type { MapMarker } from '@/components/moments/LocationMapPreview';
import type { AppTheme } from '@/constants/design-system';
import { callManager } from '@/lib/call-manager';
import type { CallMode, CallPhase } from '@/lib/call-types';
import type { Relationship, UserProfile, Moment } from '@/types/database';
import type { MomentReplyContext } from '@/lib/moment-reply';
import type { ChatOfflineItem } from '@/lib/chat-offline-queue';
import { filterMomentsForHome } from '@/lib/moment-display';
import { saveTheme } from '@/lib/theme-storage';

export interface PartnerLocationMapState {
  markers: MapMarker[];
  title?: string | null;
}

export type MomentViewerPlayback = 'story' | 'focus';

export interface MomentViewerState {
  moments: Moment[];
  startIndex: number;
  /** Story = auto-advance queue (home strip). Focus = picked moment, manual swipe only. */
  playback: MomentViewerPlayback;
  sectionLabel?: string;
  /** Re-open moment history when the viewer closes (opened from history grid). */
  returnToHistory?: boolean;
  /** Re-open partner profile when the viewer closes (opened from profile avatar). */
  returnToPartnerProfile?: boolean;
}

interface AuthState {
  user: UserProfile | null;
  session: boolean;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  setSession: (active: boolean) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: false,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, session: false, isLoading: false }),
}));

interface RelationshipState {
  relationship: Relationship | null;
  partner: UserProfile | null;
  setRelationship: (relationship: Relationship | null) => void;
  setPartner: (partner: UserProfile | null) => void;
  reset: () => void;
}

export const useRelationshipStore = create<RelationshipState>((set) => ({
  relationship: null,
  partner: null,
  setRelationship: (relationship) => set({ relationship }),
  setPartner: (partner) => set({ partner }),
  reset: () => set({ relationship: null, partner: null }),
}));

interface UIState {
  theme: AppTheme;
  /** The saved theme has been read from storage (or there was none), so `theme` is final. */
  themeReady: boolean;
  isOffline: boolean;
  showMomentCreator: boolean;
  showMomentHistory: boolean;
  /** History was opened from the camera — closing it should reopen the camera instead of exiting to Home. */
  momentHistoryReturnToCamera: boolean;
  /** History is on its way out over the camera: wake the camera now, so it's live when revealed. */
  momentCameraWaking: boolean;
  momentViewer: MomentViewerState | null;
  momentHistoryScrollY: number;
  /** Album open inside Moment history — kept here so it survives a round trip through the viewer. */
  momentHistoryAlbumId: string | null;
  /** "Our map" open inside Moment history — survives a round trip through the viewer. */
  momentHistoryMapOpen: boolean;
  showWrapped: boolean;
  showMoodHistory: boolean;
  showPaywall: boolean;
  /** What opened the paywall ("Unlimited moments"), for its headline; null for the general one. */
  paywallReason: string | null;
  /** A full headline instead (e.g. when the partner joins). */
  paywallHeadline: string | null;
  /** 'winback': the one time discounted first year. */
  paywallOffer: 'winback' | null;
  showPartnerProfile: boolean;
  partnerLocationMap: PartnerLocationMapState | null;
  streakMilestoneCount: number | null;
  /** The rating page, opened from Settings › Rate Moments. */
  showRatingPage: boolean;
  /** Dev preview: the sign-in screens, opened from Settings (shows an "Exit preview" button). */
  authPreview: boolean;
  /** Dev preview of a set of screens (onboarding, sign-in, widgets): shows the "Exit preview" pill. */
  devPreview: boolean;
  /**
   * The birthday page: on the day ('today', for whoever's birthday it is or their
   * partner) or the day before ('eve', the partner's reminder).
   */
  birthdayCelebration: BirthdayCelebration | null;
  /** Dev preview: bumped to start the app tour again. */
  tourRequest: number;
  requestTour: () => void;
  /** A together milestone (days in a row you both checked in) being celebrated. */
  togetherMilestoneCount: number | null;
  openTogetherMilestone: (count: number) => void;
  closeTogetherMilestone: () => void;
  streakSpark: { count: number; fromCount: number } | null;
  /** A trophy opened from chat or a notification (its id, or title on older cards). */
  trophyView: string | null;
  openTrophy: (idOrTitle: string) => void;
  closeTrophy: () => void;
  chatDraft: string | null;
  chatMomentReply: MomentReplyContext | null;
  paywallShownThisSession: boolean;
  typingUsers: string[];
  tabBarOverlayHeight: number;
  setTheme: (theme: AppTheme) => void;
  setOffline: (offline: boolean) => void;
  setShowMomentCreator: (show: boolean) => void;
  setShowMomentHistory: (show: boolean) => void;
  setMomentHistoryReturnToCamera: (returnToCamera: boolean) => void;
  setMomentHistoryScrollY: (y: number) => void;
  setMomentHistoryAlbumId: (id: string | null) => void;
  setMomentHistoryMapOpen: (open: boolean) => void;
  openMomentViewer: (
    moments: Moment[],
    startIndex?: number,
    options?: {
      playback?: MomentViewerPlayback;
      sectionLabel?: string;
      returnToHistory?: boolean;
      returnToPartnerProfile?: boolean;
      /** When true (default for story), only moments from the last 24h are shown. */
      homeWindowOnly?: boolean;
    },
  ) => void;
  closeMomentViewer: () => void;
  setShowWrapped: (show: boolean) => void;
  setShowMoodHistory: (show: boolean) => void;
  setChatDraft: (draft: string | null) => void;
  setChatMomentReply: (reply: MomentReplyContext | null) => void;
  clearChatDraft: () => void;
  /** `reason` names the feature that was hit. Non-string args (a press event) are ignored. */
  openPaywall: (reason?: unknown, opts?: { headline?: string; offer?: 'winback' }) => void;
  closePaywall: () => void;
  openPartnerProfile: () => void;
  closePartnerProfile: () => void;
  openPartnerLocationMap: (markers: MapMarker[], title?: string | null) => void;
  closePartnerLocationMap: () => void;
  openStreakMilestone: (count: number) => void;
  closeStreakMilestone: () => void;
  openStreakSpark: (count: number, fromCount: number) => void;
  closeStreakSpark: () => void;
  markPaywallShownThisSession: () => void;
  setTypingUsers: (users: string[]) => void;
  setTabBarOverlayHeight: (height: number) => void;
}

/** How long a full-screen Modal takes to go away before another can open (iPhone). */
const MODAL_HANDOFF_MS = 350;

/**
 * Something full-screen is on screen (Moments, the partner's profile, Wrapped, mood history,
 * the map, the paywall, or another celebration). A streak celebration has to wait for it to
 * close: on iPhone a full-screen layer opened over another one never appears — which is why
 * the celebration went missing after sending a moment from the camera.
 */
export type BirthdayCelebration = {
  kind: 'today' | 'eve';
  /** Whose birthday: yours, or your partner's. */
  whose: 'me' | 'partner';
  /** Dev preview: shown without marking it seen. */
  preview?: boolean;
};

export function isFullScreenLayerOpen(s: UIState): boolean {
  return (
    s.showMomentCreator ||
    s.showMomentHistory ||
    !!s.momentViewer ||
    s.showPartnerProfile ||
    !!s.partnerLocationMap ||
    s.showWrapped ||
    s.showMoodHistory ||
    s.showPaywall ||
    s.streakSpark != null ||
    s.streakMilestoneCount != null ||
    s.togetherMilestoneCount != null ||
    s.birthdayCelebration != null
  );
}

export const useUIStore = create<UIState>((set, get) => ({
  // Default until the theme-picker onboarding step runs and saves an explicit
  // choice (src/lib/theme-storage.ts) — i.e. this is what every new signup sees
  // through the whole auth/onboarding flow. Existing users' saved preference
  // always overrides this on boot (see AppProviders), so this never touches them.
  theme: 'violet',
  themeReady: false,
  isOffline: false,
  showMomentCreator: false,
  showMomentHistory: false,
  momentHistoryReturnToCamera: false,
  momentCameraWaking: false,
  momentViewer: null,
  momentHistoryScrollY: 0,
  momentHistoryAlbumId: null,
  momentHistoryMapOpen: false,
  showWrapped: false,
  showMoodHistory: false,
  showPaywall: false,
  paywallReason: null,
  paywallHeadline: null,
  paywallOffer: null,
  showPartnerProfile: false,
  partnerLocationMap: null,
  streakMilestoneCount: null,
  togetherMilestoneCount: null,
  authPreview: false,
  devPreview: false,
  birthdayCelebration: null,
  showRatingPage: false,
  tourRequest: 0,
  requestTour: () => set((s) => ({ tourRequest: s.tourRequest + 1 })),
  openTogetherMilestone: (togetherMilestoneCount) => set({ togetherMilestoneCount }),
  closeTogetherMilestone: () => set({ togetherMilestoneCount: null }),
  streakSpark: null,
  trophyView: null,
  openTrophy: (trophyView) => set({ trophyView }),
  closeTrophy: () => set({ trophyView: null }),
  chatDraft: null,
  chatMomentReply: null,
  paywallShownThisSession: false,
  typingUsers: [],
  tabBarOverlayHeight: 0,
  setTheme: (theme) => {
    set({ theme });
    void saveTheme(theme);
  },
  setOffline: (isOffline) => set({ isOffline }),
  setShowMomentCreator: (showMomentCreator) => set({ showMomentCreator }),
  setShowMomentHistory: (showMomentHistory) => set({ showMomentHistory }),
  setMomentHistoryReturnToCamera: (momentHistoryReturnToCamera) => set({ momentHistoryReturnToCamera }),
  setMomentHistoryScrollY: (momentHistoryScrollY) => set({ momentHistoryScrollY }),
  setMomentHistoryAlbumId: (momentHistoryAlbumId) => set({ momentHistoryAlbumId }),
  setMomentHistoryMapOpen: (momentHistoryMapOpen) => set({ momentHistoryMapOpen }),
  openMomentViewer: (moments, startIndex = 0, options) => {
    const playback = options?.playback ?? 'story';
    const applyHomeWindow = options?.homeWindowOnly ?? playback === 'story';
    const list = applyHomeWindow ? filterMomentsForHome(moments) : moments;
    if (list.length === 0) return;
    const requested = moments[startIndex];
    const resolvedIndex =
      requested != null
        ? Math.max(
            0,
            list.findIndex((m) => m.id === requested.id),
          )
        : startIndex;
    const safeIndex = resolvedIndex >= 0 ? resolvedIndex : 0;
    set({
      momentViewer: {
        moments: list,
        startIndex: Math.max(0, Math.min(safeIndex, list.length - 1)),
        playback,
        sectionLabel: options?.sectionLabel,
        returnToHistory: options?.returnToHistory,
        returnToPartnerProfile: options?.returnToPartnerProfile,
      },
    });
  },
  closeMomentViewer: () => {
    const backToProfile = !!get().momentViewer?.returnToPartnerProfile;
    set((state) => ({
      momentViewer: null,
      showMomentHistory: state.momentViewer?.returnToHistory ? true : state.showMomentHistory,
    }));
    // The profile is its own Modal: reopen it once Moments' Modal has gone, not
    // in the same moment (on iPhone it wouldn't show).
    if (backToProfile) setTimeout(() => set({ showPartnerProfile: true }), MODAL_HANDOFF_MS);
  },
  setShowWrapped: (showWrapped) => set({ showWrapped }),
  setShowMoodHistory: (showMoodHistory) => set({ showMoodHistory }),
  setChatDraft: (chatDraft) => set({ chatDraft }),
  setChatMomentReply: (chatMomentReply) => set({ chatMomentReply }),
  clearChatDraft: () => set({ chatDraft: null, chatMomentReply: null }),
  openPaywall: (reason, opts) =>
    set({
      showPaywall: true,
      paywallReason: typeof reason === 'string' ? reason : null,
      paywallHeadline: opts?.headline ?? null,
      paywallOffer: opts?.offer ?? null,
    }),
  closePaywall: () => set({ showPaywall: false, paywallReason: null, paywallHeadline: null, paywallOffer: null }),
  openPartnerProfile: () => set({ showPartnerProfile: true }),
  closePartnerProfile: () => set({ showPartnerProfile: false }),
  openPartnerLocationMap: (markers, title) => set({ partnerLocationMap: { markers, title } }),
  closePartnerLocationMap: () => set({ partnerLocationMap: null }),
  openStreakMilestone: (count) => set({ streakMilestoneCount: count }),
  closeStreakMilestone: () => set({ streakMilestoneCount: null }),
  openStreakSpark: (count, fromCount) => set({ streakSpark: { count, fromCount } }),
  closeStreakSpark: () => set({ streakSpark: null }),
  markPaywallShownThisSession: () => set({ paywallShownThisSession: true }),
  setTypingUsers: (typingUsers) => set({ typingUsers }),
  setTabBarOverlayHeight: (tabBarOverlayHeight) => set({ tabBarOverlayHeight }),
}));

interface MomentDraft {
  type: 'photo' | 'video' | null;
  mediaUri: string | null;
}

interface MomentState {
  draft: MomentDraft;
  setDraft: (draft: Partial<MomentDraft>) => void;
  clearDraft: () => void;
}

const emptyDraft: MomentDraft = {
  type: null,
  mediaUri: null,
};

export const useMomentStore = create<MomentState>((set) => ({
  draft: emptyDraft,
  setDraft: (draft) => set((s) => ({ draft: { ...s.draft, ...draft } })),
  clearDraft: () => set({ draft: emptyDraft }),
}));

interface ChatState {
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  replyingTo: null,
  setReplyingTo: (replyingTo) => set({ replyingTo }),
}));

interface CallState {
  phase: CallPhase;
  mode: CallMode;
  callId: string | null;
  partnerName: string | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeaker: boolean;
  error: string | null;
  /** When the call connected (ms): the timer counts from here. */
  connectedAt: number | null;
  /** Shrunk to the pill (voice) or floating window (video) while you use the app. */
  minimized: boolean;
  setMinimized: (minimized: boolean) => void;
  /** Video: front or back camera. */
  flipCamera: () => void;
  /**
   * Each person's camera is their own. A video call starts with both on, a voice call with
   * both off; either of you can turn yours on or off at any time.
   */
  partnerCameraOn: boolean;
  setPartnerCamera: (on: boolean) => void;
  /** Turn your camera on or off (previews just switch the screen). */
  setMyCamera: (on: boolean) => Promise<void>;
  setPhase: (phase: CallPhase) => void;
  setIncoming: (payload: { callId: string; mode: CallMode; partnerName: string }) => void;
  setMode: (mode: CallMode) => void;
  setCallId: (callId: string | null) => void;
  setPartnerName: (name: string | null) => void;
  setError: (error: string | null) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  reset: () => void;
}

const initialCallState = {
  phase: 'idle' as CallPhase,
  mode: 'audio' as CallMode,
  callId: null,
  partnerName: null,
  isMuted: false,
  isCameraOff: false,
  isSpeaker: false,
  error: null,
  connectedAt: null as number | null,
  minimized: false,
  partnerCameraOn: false,
};

export const useCallStore = create<CallState>((set, get) => ({
  ...initialCallState,
  setPhase: (phase) =>
    set((s) => ({ phase, connectedAt: phase === 'active' ? (s.connectedAt ?? Date.now()) : s.connectedAt })),
  setMinimized: (minimized) => set({ minimized }),
  flipCamera: () => callManager.switchCamera(),
  setPartnerCamera: (partnerCameraOn) => set({ partnerCameraOn }),
  setMyCamera: async (on) => {
    const preview = !!get().callId?.startsWith('preview-');
    if (!preview) await callManager.setCamera(on);
    // Video on: the speaker, as on every video call.
    set({ isCameraOff: !on, isSpeaker: on ? true : get().isSpeaker });
  },
  // A video call starts with both cameras on; a voice call with both off.
  setIncoming: ({ callId, mode, partnerName }) =>
    set({
      phase: 'incoming',
      callId,
      mode,
      partnerName,
      error: null,
      isCameraOff: mode !== 'video',
      partnerCameraOn: mode === 'video',
      isSpeaker: mode === 'video',
    }),
  setMode: (mode) => set({ mode, isCameraOff: mode !== 'video', partnerCameraOn: mode === 'video', isSpeaker: mode === 'video' }),
  setCallId: (callId) => set({ callId }),
  setPartnerName: (partnerName) => set({ partnerName }),
  setError: (error) => set({ error }),
  toggleMute: () => {
    const next = !get().isMuted;
    callManager.toggleMute(next);
    set({ isMuted: next });
  },
  toggleCamera: () => {
    void get().setMyCamera(get().isCameraOff);
  },
  toggleSpeaker: () => set((s) => ({ isSpeaker: !s.isSpeaker })),
  reset: () => set(initialCallState),
}));

interface OfflineState {
  relationshipId: string | null;
  queue: ChatOfflineItem[];
  hydrated: boolean;
  hydrateQueue: (relationshipId: string) => Promise<void>;
  addToQueue: (item: Omit<ChatOfflineItem, 'createdAt'>, relationshipId?: string) => void;
  removeFromQueue: (id: string) => void;
  /** One more failed try for a queued message. */
  noteFailedAttempt: (id: string) => void;
  clearQueue: () => void;
  resetQueue: () => void;
}

async function persistQueue(relationshipId: string | null, queue: ChatOfflineItem[]) {
  if (!relationshipId) return;
  const { saveChatOfflineQueue } = await import('@/lib/chat-offline-queue');
  await saveChatOfflineQueue(relationshipId, queue);
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  relationshipId: null,
  queue: [],
  hydrated: false,
  hydrateQueue: async (relationshipId) => {
    const { loadChatOfflineQueue } = await import('@/lib/chat-offline-queue');
    const items = await loadChatOfflineQueue(relationshipId);
    set({
      relationshipId,
      queue: items,
      hydrated: true,
    });
  },
  addToQueue: (item, relationshipId) => {
    set((s) => {
      const relId = relationshipId ?? s.relationshipId;
      const queue = [...s.queue, { ...item, createdAt: new Date().toISOString() }];
      void persistQueue(relId, queue);
      return { queue, ...(relId ? { relationshipId: relId } : {}) };
    });
  },
  removeFromQueue: (id) => {
    set((s) => {
      const queue = s.queue.filter((q) => q.id !== id);
      void persistQueue(s.relationshipId, queue);
      return { queue };
    });
  },
  noteFailedAttempt: (id) => {
    set((s) => {
      const queue = s.queue.map((q) => (q.id === id ? { ...q, attempts: (q.attempts ?? 0) + 1 } : q));
      void persistQueue(s.relationshipId, queue);
      return { queue };
    });
  },
  clearQueue: () => {
    const { relationshipId } = get();
    set({ queue: [] });
    if (relationshipId) {
      void import('@/lib/chat-offline-queue').then(({ clearChatOfflineQueue }) =>
        clearChatOfflineQueue(relationshipId),
      );
    }
  },
  resetQueue: () => set({ relationshipId: null, queue: [], hydrated: false }),
}));
