import { currentIceServers, getIceServers } from '@/lib/call-types';
import { getWebRTCModule } from '@/lib/webrtc-native';

import type { AudioSignal } from './types';

type Track = { stop: () => void; enabled: boolean };
type Stream = { getTracks: () => Track[]; getAudioTracks: () => Track[] };
type Peer = {
  addTrack: (track: unknown, stream: Stream) => void;
  close: () => void;
  ontrack: ((event: { streams: Stream[] }) => void) | null;
  onicecandidate: ((event: { candidate: { toJSON: () => unknown } | null }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  connectionState?: string;
  createOffer: () => Promise<unknown>;
  createAnswer: () => Promise<unknown>;
  setLocalDescription: (d: unknown) => Promise<void>;
  setRemoteDescription: (d: unknown) => Promise<void>;
  addIceCandidate: (c: unknown) => Promise<void>;
};

export type AudioStatus = 'off' | 'connecting' | 'live' | 'unavailable';

/**
 * Voice chat for a game room — audio-only WebRTC signalled over the room's own realtime channel
 * (the host offers, the guest answers). Silently reports `unavailable` where WebRTC doesn't
 * exist (Expo Go / web) so the room still works with text + reactions only.
 */
export class RoomAudio {
  private stream: Stream | null = null;
  private pc: Peer | null = null;
  private stopped = true;
  private guestReady = false;
  private pendingIce: unknown[] = [];

  constructor(
    private readonly isHost: boolean,
    private readonly send: (signal: AudioSignal) => void,
    private readonly onStatus: (status: AudioStatus) => void,
  ) {}

  static isSupported() {
    return getWebRTCModule() != null;
  }

  async start() {
    // Relay servers ready before the first connection (createPeer can't wait for them).
    await getIceServers();
    const webrtc = getWebRTCModule();
    if (!webrtc) {
      this.onStatus('unavailable');
      return;
    }
    this.stopped = false;
    this.onStatus('connecting');
    try {
      this.stream = (await webrtc.mediaDevices.getUserMedia({ audio: true, video: false })) as unknown as Stream;
    } catch {
      this.onStatus('unavailable');
      this.stopped = true;
      return;
    }
    this.send({ type: 'ready' });
    if (this.isHost && this.guestReady) await this.offer();
  }

  private createPeer(): Peer {
    const webrtc = getWebRTCModule()!;
    this.pc?.close();
    this.pendingIce = [];
    const pc = new webrtc.RTCPeerConnection({ iceServers: currentIceServers() }) as unknown as Peer;
    this.stream?.getTracks().forEach((track) => pc.addTrack(track, this.stream!));
    pc.ontrack = () => this.onStatus('live');
    pc.onicecandidate = (event) => {
      if (event.candidate) this.send({ type: 'ice', candidate: event.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') this.onStatus('live');
      else if (state === 'failed' || state === 'disconnected') this.onStatus('connecting');
    };
    this.pc = pc;
    return pc;
  }

  private async offer() {
    if (this.stopped || !this.stream) return;
    const pc = this.createPeer();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.send({ type: 'offer', sdp: offer });
  }

  async handle(signal: AudioSignal) {
    if (this.stopped) {
      // Guest may receive 'ready' before it started; remember it so start() can offer.
      if (signal.type === 'ready') this.guestReady = true;
      return;
    }
    try {
      switch (signal.type) {
        case 'ready':
          if (this.isHost) {
            this.guestReady = true;
            await this.offer();
          } else {
            // Host (re)joined — let it know we're ready so it re-offers.
            this.send({ type: 'ready' });
          }
          break;
        case 'offer': {
          if (this.isHost || !this.stream) return;
          const pc = this.createPeer();
          await pc.setRemoteDescription(signal.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.send({ type: 'answer', sdp: answer });
          await this.flushIce();
          break;
        }
        case 'answer':
          if (!this.isHost || !this.pc) return;
          await this.pc.setRemoteDescription(signal.sdp);
          await this.flushIce();
          break;
        case 'ice':
          if (this.pc) {
            try {
              await this.pc.addIceCandidate(signal.candidate);
            } catch {
              this.pendingIce.push(signal.candidate);
            }
          } else {
            this.pendingIce.push(signal.candidate);
          }
          break;
      }
    } catch {
      this.onStatus('connecting');
    }
  }

  private async flushIce() {
    const queued = this.pendingIce;
    this.pendingIce = [];
    for (const candidate of queued) {
      try {
        await this.pc?.addIceCandidate(candidate);
      } catch {
        // stale candidate — ignore
      }
    }
  }

  setMuted(muted: boolean) {
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  stop() {
    this.stopped = true;
    this.guestReady = false;
    this.pendingIce = [];
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.pc?.close();
    this.pc = null;
    this.onStatus('off');
  }
}
