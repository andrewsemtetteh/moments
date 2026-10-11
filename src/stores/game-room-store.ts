import { create } from 'zustand';

import type { AudioStatus } from '@/lib/game-room/audio';
import type { LiveGameKind, RoomState } from '@/lib/game-room/types';

export interface FloatingReaction {
  id: string;
  emoji: string;
  from: string;
  /** 0–1 horizontal position so bursts don't stack. */
  x: number;
}

export interface RoomInvite {
  roomId: string;
  game: LiveGameKind;
  fromName: string;
}

interface GameRoomStoreState {
  /** The full-screen room UI is showing. */
  open: boolean;
  state: RoomState | null;
  connected: boolean;
  partnerOnline: boolean;
  partnerInRoom: boolean;
  audio: AudioStatus;
  muted: boolean;
  invite: RoomInvite | null;
  notice: string | null;
  reactions: FloatingReaction[];
  /** Milliseconds the guest's clock is ahead of the host's (0 for the host). */
  clockSkew: number;
}

export const useGameRoomStore = create<GameRoomStoreState>(() => ({
  open: false,
  state: null,
  connected: false,
  partnerOnline: false,
  partnerInRoom: false,
  audio: 'off',
  muted: false,
  invite: null,
  notice: null,
  reactions: [],
  clockSkew: 0,
}));
