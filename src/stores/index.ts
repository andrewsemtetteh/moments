import { create } from 'zustand';

import type { AppTheme } from '@/constants/design-system';
import { callManager } from '@/lib/call-manager';
import type { CallMode, CallPhase } from '@/lib/call-types';
import type { Relationship, UserProfile, Moment } from '@/types/database';
import type { MomentReplyContext } from '@/lib/moment-reply';

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
  isOffline: boolean;
  showMomentCreator: boolean;
  showMomentHistory: boolean;
  momentViewer: MomentViewerState | null;
  momentHistoryScrollY: number;
  showJournal: boolean;
  showWrapped: boolean;
  showMomentRecapVideo: boolean;
  recapVideoMoments: Moment[] | null;
  showMoodHistory: boolean;
  showPaywall: boolean;
  showPartnerProfile: boolean;
  showWatchTogether: boolean;
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
  setMomentHistoryScrollY: (y: number) => void;
  openMomentViewer: (
    moments: Moment[],
    startIndex?: number,
    options?: {
      playback?: MomentViewerPlayback;
      sectionLabel?: string;
      returnToHistory?: boolean;
      returnToPartnerProfile?: boolean;
    },
  ) => void;
  closeMomentViewer: () => void;
  setShowJournal: (show: boolean) => void;
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
  markPaywallShownThisSession: () => void;
  setTypingUsers: (users: string[]) => void;
  setTabBarOverlayHeight: (height: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'black',
  isOffline: false,
  showMomentCreator: false,
  showMomentHistory: false,
  momentViewer: null,
  momentHistoryScrollY: 0,
  showJournal: false,
  showWrapped: false,
  showMomentRecapVideo: false,
  recapVideoMoments: null,
  showMoodHistory: false,
  showPaywall: false,
  showPartnerProfile: false,
  showWatchTogether: false,
  watchInitialView: 'hub',
  chatDraft: null,
  chatMomentReply: null,
  paywallShownThisSession: false,
  typingUsers: [],
  tabBarOverlayHeight: 0,
  setTheme: (theme) => set({ theme }),
  setOffline: (isOffline) => set({ isOffline }),
  setShowMomentCreator: (showMomentCreator) => set({ showMomentCreator }),
  setShowMomentHistory: (showMomentHistory) => set({ showMomentHistory }),
  setMomentHistoryScrollY: (momentHistoryScrollY) => set({ momentHistoryScrollY }),
  openMomentViewer: (moments, startIndex = 0, options) =>
    set({
      momentViewer: {
        moments,
        startIndex: Math.max(0, Math.min(startIndex, Math.max(moments.length - 1, 0))),
        playback: options?.playback ?? 'story',
        sectionLabel: options?.sectionLabel,
        returnToHistory: options?.returnToHistory,
        returnToPartnerProfile: options?.returnToPartnerProfile,
      },
    }),
  closeMomentViewer: () =>
    set((state) => ({
      momentViewer: null,
      showMomentHistory: state.momentViewer?.returnToHistory ? true : state.showMomentHistory,
      showPartnerProfile: state.momentViewer?.returnToPartnerProfile
        ? true
        : state.showPartnerProfile,
    })),
  setShowJournal: (showJournal) => set({ showJournal }),
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

interface OfflineQueueItem {
  id: string;
  type: 'message' | 'moment';
  payload: Record<string, unknown>;
  createdAt: string;
}

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
  queue: OfflineQueueItem[];
  addToQueue: (item: Omit<OfflineQueueItem, 'createdAt'>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  queue: [],
  addToQueue: (item) =>
    set((s) => ({
      queue: [...s.queue, { ...item, createdAt: new Date().toISOString() }],
    })),
  removeFromQueue: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
  clearQueue: () => set({ queue: [] }),
}));
