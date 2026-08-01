import { create } from 'zustand';

import type { AppTheme } from '@/constants/design-system';
import { callManager } from '@/lib/call-manager';
import type { CallMode, CallPhase } from '@/lib/call-types';
import type { Relationship, UserProfile, Moment, SharedAlbumItem } from '@/types/database';
import type { MomentReplyContext } from '@/lib/moment-reply';
import type { ChatOfflineItem } from '@/lib/chat-offline-queue';
import { filterMomentsForHome } from '@/lib/moment-display';

export type MomentViewerPlayback = 'story' | 'focus';

export interface MomentViewerState {
  moments: Moment[];
  startIndex: number;
  /** Story = auto-advance queue (home strip). Focus = picked moment, manual swipe only. */
  playback: MomentViewerPlayback;
  sectionLabel?: string;
  /** Re-open moment history when the viewer closes (opened from history grid). */
  returnToHistory?: boolean;
  /** Re-open shared album when the viewer closes (opened from album grid). */
  returnToAlbum?: boolean;
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

export interface AlbumViewerState {
  items: SharedAlbumItem[];
  startIndex: number;
  sectionLabel?: string;
  returnToAlbum?: boolean;
}

interface UIState {
  theme: AppTheme;
  isOffline: boolean;
  showMomentCreator: boolean;
  showMomentHistory: boolean;
  showSharedAlbum: boolean;
  albumViewer: AlbumViewerState | null;
  momentViewer: MomentViewerState | null;
  momentHistoryScrollY: number;
  sharedAlbumScrollY: number;
  showWrapped: boolean;
  showMomentRecapVideo: boolean;
  recapVideoMoments: Moment[] | null;
  showMoodHistory: boolean;
  showPaywall: boolean;
  showPartnerProfile: boolean;
  showWatchTogether: boolean;
  streakMilestoneCount: number | null;
  streakSpark: { count: number; fromCount: number } | null;
  watchInitialView: 'hub' | 'start' | 'watchlist' | 'schedule';
  chatDraft: string | null;
  chatMomentReply: MomentReplyContext | null;
  paywallShownThisSession: boolean;
  typingUsers: string[];
  tabBarOverlayHeight: number;
  setTheme: (theme: AppTheme) => void;
  setOffline: (offline: boolean) => void;
  setShowMomentCreator: (show: boolean) => void;
  setShowMomentHistory: (show: boolean) => void;
  setShowSharedAlbum: (show: boolean) => void;
  openAlbumViewer: (
    items: SharedAlbumItem[],
    startIndex?: number,
    options?: { sectionLabel?: string; returnToAlbum?: boolean },
  ) => void;
  closeAlbumViewer: () => void;
  setMomentHistoryScrollY: (y: number) => void;
  setSharedAlbumScrollY: (y: number) => void;
  openMomentViewer: (
    moments: Moment[],
    startIndex?: number,
    options?: {
      playback?: MomentViewerPlayback;
      sectionLabel?: string;
      returnToHistory?: boolean;
      returnToAlbum?: boolean;
      returnToPartnerProfile?: boolean;
      /** When true (default for story), only moments from the last 24h are shown. */
      homeWindowOnly?: boolean;
    },
  ) => void;
  closeMomentViewer: () => void;
  setShowWrapped: (show: boolean) => void;
  openMomentRecapVideo: (moments: Moment[]) => void;
  closeMomentRecapVideo: () => void;
  setShowMoodHistory: (show: boolean) => void;
  setShowWatchTogether: (show: boolean) => void;
  setChatDraft: (draft: string | null) => void;
  setChatMomentReply: (reply: MomentReplyContext | null) => void;
  clearChatDraft: () => void;
  openPaywall: () => void;
  closePaywall: () => void;
  openPartnerProfile: () => void;
  closePartnerProfile: () => void;
  openWatchTogether: (view?: 'hub' | 'start' | 'watchlist' | 'schedule') => void;
  closeWatchTogether: () => void;
  openStreakMilestone: (count: number) => void;
  closeStreakMilestone: () => void;
  openStreakSpark: (count: number, fromCount: number) => void;
  closeStreakSpark: () => void;
  markPaywallShownThisSession: () => void;
  setTypingUsers: (users: string[]) => void;
  setTabBarOverlayHeight: (height: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'black',
  isOffline: false,
  showMomentCreator: false,
  showMomentHistory: false,
  showSharedAlbum: false,
  albumViewer: null,
  momentViewer: null,
  momentHistoryScrollY: 0,
  sharedAlbumScrollY: 0,
  showWrapped: false,
  showMomentRecapVideo: false,
  recapVideoMoments: null,
  showMoodHistory: false,
  showPaywall: false,
  showPartnerProfile: false,
  showWatchTogether: false,
  watchInitialView: 'hub',
  streakMilestoneCount: null,
  streakSpark: null,
  chatDraft: null,
  chatMomentReply: null,
  paywallShownThisSession: false,
  typingUsers: [],
  tabBarOverlayHeight: 0,
  setTheme: (theme) => set({ theme }),
  setOffline: (isOffline) => set({ isOffline }),
  setShowMomentCreator: (showMomentCreator) => set({ showMomentCreator }),
  setShowMomentHistory: (showMomentHistory) => set({ showMomentHistory }),
  setShowSharedAlbum: (showSharedAlbum) => set({ showSharedAlbum }),
  openAlbumViewer: (items, startIndex = 0, options) =>
    set({
      albumViewer: {
        items,
        startIndex: Math.max(0, Math.min(startIndex, Math.max(items.length - 1, 0))),
        sectionLabel: options?.sectionLabel,
        returnToAlbum: options?.returnToAlbum,
      },
    }),
  closeAlbumViewer: () =>
    set((state) => ({
      albumViewer: null,
      showSharedAlbum: state.albumViewer?.returnToAlbum ? true : state.showSharedAlbum,
    })),
  setMomentHistoryScrollY: (momentHistoryScrollY) => set({ momentHistoryScrollY }),
  setSharedAlbumScrollY: (sharedAlbumScrollY) => set({ sharedAlbumScrollY }),
  openMomentViewer: (moments, startIndex = 0, options) => {
    const playback = options?.playback ?? 'story';
    const applyHomeWindow = options?.homeWindowOnly ?? playback === 'story';
    const list = applyHomeWindow ? filterMomentsForHome(moments) : moments;
    if (list.length === 0) return;
    const requested = moments[startIndex];
    const resolvedIndex =
      requested != null ? Math.max(0, list.findIndex((m) => m.id === requested.id)) : startIndex;
    const safeIndex = resolvedIndex >= 0 ? resolvedIndex : 0;
    set({
      momentViewer: {
        moments: list,
        startIndex: Math.max(0, Math.min(safeIndex, list.length - 1)),
        playback,
        sectionLabel: options?.sectionLabel,
        returnToHistory: options?.returnToHistory,
        returnToAlbum: options?.returnToAlbum,
        returnToPartnerProfile: options?.returnToPartnerProfile,
      },
    });
  },
  closeMomentViewer: () =>
    set((state) => ({
      momentViewer: null,
      showMomentHistory: state.momentViewer?.returnToHistory ? true : state.showMomentHistory,
      showSharedAlbum: state.momentViewer?.returnToAlbum ? true : state.showSharedAlbum,
      showPartnerProfile: state.momentViewer?.returnToPartnerProfile
        ? true
        : state.showPartnerProfile,
    })),
  setShowWrapped: (showWrapped) => set({ showWrapped }),
  openMomentRecapVideo: (moments) => set({ recapVideoMoments: moments, showMomentRecapVideo: true }),
  closeMomentRecapVideo: () => set({ recapVideoMoments: null, showMomentRecapVideo: false }),
  setShowMoodHistory: (showMoodHistory) => set({ showMoodHistory }),
  setShowWatchTogether: (showWatchTogether) => set({ showWatchTogether }),
  setChatDraft: (chatDraft) => set({ chatDraft }),
  setChatMomentReply: (chatMomentReply) => set({ chatMomentReply }),
  clearChatDraft: () => set({ chatDraft: null, chatMomentReply: null }),
  openPaywall: () => set({ showPaywall: true }),
  closePaywall: () => set({ showPaywall: false }),
  openPartnerProfile: () => set({ showPartnerProfile: true }),
  closePartnerProfile: () => set({ showPartnerProfile: false }),
  openWatchTogether: (view = 'hub') => set({ showWatchTogether: true, watchInitialView: view }),
  closeWatchTogether: () => set({ showWatchTogether: false }),
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
};

export const useCallStore = create<CallState>((set, get) => ({
  ...initialCallState,
  setPhase: (phase) => set({ phase }),
  setIncoming: ({ callId, mode, partnerName }) =>
    set({ phase: 'incoming', callId, mode, partnerName, error: null }),
  setMode: (mode) => set({ mode }),
  setCallId: (callId) => set({ callId }),
  setPartnerName: (partnerName) => set({ partnerName }),
  setError: (error) => set({ error }),
  toggleMute: () => {
    const next = !get().isMuted;
    callManager.toggleMute(next);
    set({ isMuted: next });
  },
  toggleCamera: () => {
    const next = !get().isCameraOff;
    callManager.toggleCamera(next);
    set({ isCameraOff: next });
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
