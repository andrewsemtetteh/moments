import type { RealtimeChannel } from '@/lib/cloudflare';

import { backend } from '@/lib/backend';
import { fetchGameContent } from '@/services/game-content';
import { encodeAttachment } from '@/lib/chat-attachments';
import { sendMessage, sendPartnerNotification } from '@/services/api';
import { useCallStore } from '@/stores';
import { useGameRoomStore } from '@/stores/game-room-store';
import { usePlayProgressStore } from '@/stores/play-progress-store';

import { RoomAudio } from './audio';
import { createRoom, needsMoreItems, reduceRoom, statsFromRoom } from './reducer';
import { finishedLine } from './result-line';
import { rivalryAward } from './rivalry';
import {
  getGameDefinition,
  type LiveGameKind,
  type RoomAction,
  type RoomPlayer,
  type RoomState,
  type WireMessage,
} from './types';

const roomStore = useGameRoomStore;

function newRoomId() {
  return `room_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Owns the shared realtime channel for a couple's live game rooms.
 * - Host-authoritative: whoever opens the room runs the reducer and broadcasts state.
 * - Presence tells each phone whether the other is online / inside the room.
 * - Voice chat rides the same channel (see RoomAudio).
 */
class GameRoomManager {
  private channel: RealtimeChannel | null = null;
  private ready = false;
  private relationshipId = '';
  private me: RoomPlayer | null = null;
  private partner: RoomPlayer | null = null;
  private audio: RoomAudio | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private notifiedRooms = new Set<string>();
  private awardedRooms = new Set<string>();

  attach(relationshipId: string, me: RoomPlayer, partner: RoomPlayer) {
    const same = this.channel && this.relationshipId === relationshipId && this.me?.id === me.id;
    this.me = me;
    this.partner = partner;
    if (same) return;

    void this.detach();
    this.relationshipId = relationshipId;

    const channel = backend.channel(`gameroom:${relationshipId}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });

    channel
      .on('broadcast', { event: 'msg' }, ({ payload }) => this.onMessage(payload as WireMessage))
      .on('presence', { event: 'sync' }, () => this.syncPresence())
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key === this.partner?.id) this.onPartnerJoined();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.ready = true;
          roomStore.setState({ connected: true });
          void this.track();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.ready = false;
          roomStore.setState({ connected: false, partnerOnline: false, partnerInRoom: false });
        }
      });

    this.channel = channel;
  }

  async detach() {
    this.clearTimer();
    this.stopAudio();
    if (this.channel) {
      await backend.removeChannel(this.channel);
      this.channel = null;
    }
    this.ready = false;
    roomStore.setState({
      open: false,
      state: null,
      connected: false,
      partnerOnline: false,
      partnerInRoom: false,
      invite: null,
      notice: null,
      reactions: [],
      audio: 'off',
    });
  }

  private get isHost() {
    const state = roomStore.getState().state;
    return !!state && !!this.me && state.hostId === this.me.id;
  }

  private async track() {
    if (!this.channel || !this.ready) return;
    await this.channel.track({ inRoom: roomStore.getState().open, at: Date.now() });
  }

  private syncPresence() {
    if (!this.channel || !this.partner) return;
    const presence = this.channel.presenceState() as Record<string, { inRoom?: boolean }[]>;
    const theirs = presence[this.partner.id];
    roomStore.setState({
      partnerOnline: !!theirs?.length,
      partnerInRoom: !!theirs?.some((m) => m.inRoom),
    });
  }

  private onPartnerJoined() {
    this.syncPresence();
    const state = roomStore.getState().state;
    // Re-send the current room so a partner who just opened the app sees the invite / catches up.
    if (this.isHost && state && state.phase !== 'finished') this.pushState(state);
  }

  private async send(message: WireMessage) {
    if (!this.channel || !this.ready) return;
    try {
      await this.channel.send({ type: 'broadcast', event: 'msg', payload: message });
    } catch {
      // transient realtime hiccup — the next state broadcast resyncs
    }
  }

  private pushState(state: RoomState) {
    void this.send({ kind: 'state', state: { ...state, hostNow: Date.now() } });
  }

  private onMessage(message: WireMessage) {
    if (!message || !this.me) return;
    switch (message.kind) {
      case 'state':
        this.receiveState(message.state);
        break;
      case 'action':
        if (this.isHost) this.applyAsHost(message.action, message.from);
        break;
      case 'reaction':
        this.pushReaction(message.from, message.emoji, message.id);
        break;
      case 'audio':
        void this.audio?.handle(message.signal);
        break;
      case 'closed': {
        const store = roomStore.getState();
        if (store.state && store.state.hostId === message.from) {
          const hostName = store.state.players.find((p) => p.id === message.from)?.name ?? 'Your partner';
          this.stopAudio();
          roomStore.setState({
            state: null,
            invite: null,
            open: false,
            notice: store.open ? `${hostName} closed the room` : null,
          });
          void this.track();
        }
        break;
      }
    }
  }

  private receiveState(incoming: RoomState) {
    if (!this.me || incoming.hostId === this.me.id) return;
    const store = roomStore.getState();
    const cur = store.state;
    if (cur && cur.id === incoming.id && incoming.v <= cur.v) return;

    const clockSkew = incoming.hostNow ? Date.now() - incoming.hostNow : 0;
    let invite = store.invite;
    if (!store.open) {
      if (incoming.phase === 'finished') invite = null;
      else if (!invite || invite.roomId !== incoming.id) {
        invite = {
          roomId: incoming.id,
          game: incoming.game,
          fromName: incoming.players.find((p) => p.id === incoming.hostId)?.name ?? 'Your partner',
        };
      }
    }
    roomStore.setState({ state: incoming, clockSkew, invite });
  }

  private commit(next: RoomState, prev: RoomState | null) {
    roomStore.setState({ state: next });
    this.pushState(next);
    this.scheduleTimer(next);

    if (next.phase === 'loading' && prev?.phase !== 'loading') void this.loadContent(next);
    // Unlimited rounds: the host's phone fetches more questions as the loaded ones run low.
    if (next.hostId === this.me?.id && needsMoreItems(next)) void this.topUp(next);
    if (next.phase === 'finished' && prev?.phase !== 'finished') this.onFinished(next);
  }

  private applyAsHost(action: RoomAction, from: string) {
    const cur = roomStore.getState().state;
    if (!cur || !this.me || cur.hostId !== this.me.id) return;
    const next = reduceRoom(cur, action, from);
    if (next === cur) return;
    this.commit(next, cur);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private scheduleTimer(state: RoomState) {
    this.clearTimer();
    if (state.game !== 'quiz' || state.phase !== 'playing' || state.step !== 'answer' || !state.deadline) return;
    const round = state.round;
    const id = state.id;
    this.timer = setTimeout(() => {
      const cur = roomStore.getState().state;
      if (cur && cur.id === id && cur.round === round && cur.step === 'answer') {
        this.applyAsHost({ t: 'timeout' }, this.me?.id ?? '');
      }
    }, Math.max(0, state.deadline - Date.now()) + 400);
  }

  /** Unlimited rounds: another batch of questions on the end (one fetch at a time). */
  private toppingUp = false;
  private async topUp(state: RoomState) {
    if (this.toppingUp) return;
    this.toppingUp = true;
    try {
      const content = await fetchGameContent({
        relationshipId: this.relationshipId,
        game: state.game,
        vibe: state.vibe,
        count: 10,
        topic: state.topic,
        names: state.players.map((p) => p.name),
      });
      if (content.items.length) this.applyAsHost({ t: 'more', items: content.items }, this.me?.id ?? '');
    } catch {
      // The game loops round the questions it has; the next round tries again.
    } finally {
      this.toppingUp = false;
    }
  }

  private async loadContent(state: RoomState) {
    const count = Math.max(state.totalRounds, 4);
    const content = await fetchGameContent({
      relationshipId: this.relationshipId,
      game: state.game,
      vibe: state.vibe,
      count,
      topic: state.topic,
      names: state.players.map((p) => p.name),
    });
    const usable = state.game === 'twoTruths' || content.items.length > 0 || !!content.pool;
    if (!usable) {
      this.applyAsHost({ t: 'loadFailed', message: 'Couldn’t load rounds. Try again.' }, this.me?.id ?? '');
      return;
    }
    this.applyAsHost({ t: 'loaded', items: content.items, pool: content.pool }, this.me?.id ?? '');
  }

  private onFinished(state: RoomState) {
    this.clearTimer();
    if (!state.result || this.awardedRooms.has(`${state.id}:${state.v}`)) return;
    // One award per finished round of a room (rematch reuses the room id).
    this.awardedRooms.add(`${state.id}:${state.v}`);
    const events: Record<string, number> = { game_played: 1, live_played: 1 };
    if (state.tally.sync_matches) events.sync_match = state.tally.sync_matches;
    if (state.tally.dares_done) events.dare_done = state.tally.dares_done;
    if (state.game === 'quiz' && state.result.winnerId) events.quiz_win = 1;
    // Your head-to-head record and sync bests ride along with the game's award.
    const rivalry = rivalryAward(state.game, state.result);
    void usePlayProgressStore
      .getState()
      .award(
        this.relationshipId,
        { xp: state.result.xp, stats: { ...statsFromRoom(state), ...rivalry.stats }, maxStats: rivalry.maxStats, events },
        'Live game finished',
      );
    // The result in your chat, like an own-time game's: posted once, by the host's phone.
    if (this.me && this.partner && state.hostId === this.me.id) {
      const line = finishedLine(state, this.me, this.partner);
      const def = getGameDefinition(state.game);
      if (line) {
        void sendMessage(
          this.relationshipId,
          this.me.id,
          encodeAttachment({
            type: 'game',
            kind: 'live',
            id: state.id,
            title: def.title,
            emoji: def.emoji,
            status: 'finished',
            line,
          }),
        ).catch(() => undefined);
      }
    }
  }

  // ---- public API ---------------------------------------------------------

  /** Open the room UI — join the partner's room if one is live, else start a fresh lobby as host. */
  async openRoom(game?: LiveGameKind): Promise<boolean> {
    if (!this.me || !this.partner) return false;
    const store = roomStore.getState();
    const cur = store.state;
    roomStore.setState({ open: true, notice: null, invite: null });

    const liveRoom = !!cur && cur.phase !== 'finished';
    if (!liveRoom) {
      const room = createRoom({
        id: newRoomId(),
        hostId: this.me.id,
        players: [this.me, this.partner],
        game,
      });
      this.commit(room, null);
      this.inviteByPush(room);
    } else if (game && cur.hostId === this.me.id && cur.phase === 'lobby') {
      this.applyAsHost(
        { t: 'configure', game, vibe: cur.vibe, rounds: getGameDefinition(game).defaultRounds, topic: cur.topic },
        this.me.id,
      );
    }

    await this.track();
    void this.startAudio();
    return true;
  }

  private inviteByPush(room: RoomState) {
    if (!this.partner || !this.me || this.notifiedRooms.has(room.id)) return;
    this.notifiedRooms.add(room.id);
    // If they're already online the realtime invite banner reaches them instantly; only nudge offline partners.
    if (roomStore.getState().partnerOnline) return;
    void sendPartnerNotification(
      this.relationshipId,
      this.partner.id,
      'game_invite',
      `${this.me.name} opened a live game room. Come play!`,
    ).catch(() => undefined);
  }

  /** Leave the room UI. The host closing tears the room down for both. */
  async leaveRoom() {
    const store = roomStore.getState();
    const state = store.state;
    this.stopAudio();
    roomStore.setState({ open: false, notice: null });
    if (state && this.me && state.hostId === this.me.id) {
      this.clearTimer();
      roomStore.setState({ state: null });
      void this.send({ kind: 'closed', from: this.me.id });
    }
    await this.track();
  }

  /** Guest dismissing an invite without joining. */
  dismissInvite() {
    roomStore.setState({ invite: null });
  }

  dispatch(action: RoomAction) {
    const cur = roomStore.getState().state;
    if (!cur || !this.me) return;
    if (cur.hostId === this.me.id) this.applyAsHost(action, this.me.id);
    else void this.send({ kind: 'action', from: this.me.id, action });
  }

  react(emoji: string) {
    if (!this.me) return;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.pushReaction(this.me.id, emoji, id);
    void this.send({ kind: 'reaction', from: this.me.id, emoji, id });
  }

  private pushReaction(from: string, emoji: string, id: string) {
    const reaction = { id, emoji, from, x: 0.1 + Math.random() * 0.8 };
    roomStore.setState((s) => ({ reactions: [...s.reactions.slice(-11), reaction] }));
    setTimeout(() => {
      roomStore.setState((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) }));
    }, 2600);
  }

  // ---- audio --------------------------------------------------------------

  async startAudio() {
    if (!this.me) return;
    this.stopAudio();
    if (!RoomAudio.isSupported() || useCallStore.getState().phase !== 'idle') {
      roomStore.setState({ audio: 'unavailable' });
      return;
    }
    const isHost = this.isHost;
    const me = this.me;
    this.audio = new RoomAudio(
      isHost,
      (signal) => void this.send({ kind: 'audio', from: me.id, signal }),
      (audio) => roomStore.setState({ audio }),
    );
    this.audio.setMuted(roomStore.getState().muted);
    await this.audio.start();
    this.audio?.setMuted(roomStore.getState().muted);
  }

  private stopAudio() {
    this.audio?.stop();
    this.audio = null;
    roomStore.setState({ audio: 'off' });
  }

  setMuted(muted: boolean) {
    roomStore.setState({ muted });
    this.audio?.setMuted(muted);
  }
}

export const gameRoom = new GameRoomManager();
