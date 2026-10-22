import type { RealtimeChannel } from '@/lib/cloudflare';

import { createCallId, getIceServers, type CallMode, type CallSignal } from '@/lib/call-types';
import { getWebRTCModule } from '@/lib/webrtc-native';
import { backend } from '@/lib/backend';

type NativeTrack = { stop: () => void; enabled: boolean; kind?: string };
type NativeStream = {
  getTracks: () => NativeTrack[];
  getAudioTracks: () => NativeTrack[];
  getVideoTracks: () => NativeTrack[];
  addTrack?: (track: NativeTrack) => void;
  removeTrack?: (track: NativeTrack) => void;
  toURL: () => string;
};
type Sender = { track: NativeTrack | null };

export type CallManagerCallbacks = {
  onLocalStream?: (stream: NativeStream | null) => void;
  onRemoteStream?: (stream: NativeStream | null) => void;
  onPhase?: (phase: 'connecting' | 'active' | 'ended') => void;
  onInvite?: (signal: Extract<CallSignal, { type: 'invite' }>) => void;
  onError?: (message: string) => void;
  /** The other person turned their camera on or off. */
  onPartnerCamera?: (on: boolean) => void;
};

/** How often a ringing call re-sends its invite, and how long it rings before giving up. */
const RING_REPEAT_MS = 3000;
const RING_TIMEOUT_MS = 45_000;

export class CallManager {
  private channel: RealtimeChannel | null = null;
  private pc: unknown = null;
  private localStream: NativeStream | null = null;
  private remoteStream: NativeStream | null = null;
  private ready = false;
  private callId: string | null = null;
  private mode: CallMode = 'audio';
  private relationshipId = '';
  private userId = '';
  private userName = '';
  private isInitiator = false;
  /** While ringing: the invite repeats, so a partner who opens the app from the push still gets it. */
  private ringTimer: ReturnType<typeof setInterval> | null = null;
  private ringTimeout: ReturnType<typeof setTimeout> | null = null;
  private callbacks: CallManagerCallbacks = {};
  private streamCallbacks: Pick<CallManagerCallbacks, 'onLocalStream' | 'onRemoteStream'> = {};

  setCallbacks(callbacks: CallManagerCallbacks) {
    this.callbacks = callbacks;
  }

  setStreamCallbacks(callbacks: Pick<CallManagerCallbacks, 'onLocalStream' | 'onRemoteStream'>) {
    this.streamCallbacks = callbacks;
  }

  async attachChannel(relationshipId: string, userId: string, userName: string) {
    this.relationshipId = relationshipId;
    this.userId = userId;
    this.userName = userName;

    if (this.channel) {
      await backend.removeChannel(this.channel);
      this.channel = null;
    }

    const ch = backend.channel(`call:${relationshipId}`, {
      config: { broadcast: { self: false } },
    });

    ch.on('broadcast', { event: 'signal' }, ({ payload }) => {
      const signal = payload as CallSignal;
      if (!signal?.type || signal.fromUserId === userId) return;
      void this.handleSignal(signal);
    }).subscribe((status) => {
      this.ready = status === 'SUBSCRIBED';
    });

    this.channel = ch;
  }

  async detachChannel() {
    if (this.channel) {
      await backend.removeChannel(this.channel);
      this.channel = null;
    }
    this.ready = false;
  }

  private async sendSignal(signal: CallSignal) {
    if (!this.channel || !this.ready) return;
    await this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: signal,
    });
  }

  private ensureWebRTC() {
    const webrtc = getWebRTCModule();
    if (!webrtc) {
      throw new Error('Calls require a development build. WebRTC is not available in Expo Go.');
    }
    return webrtc;
  }

  private emitLocalStream() {
    this.callbacks.onLocalStream?.(this.localStream);
    this.streamCallbacks.onLocalStream?.(this.localStream);
  }

  private emitRemoteStream() {
    this.callbacks.onRemoteStream?.(this.remoteStream);
    this.streamCallbacks.onRemoteStream?.(this.remoteStream);
  }

  private async getUserMedia(mode: CallMode) {
    const { mediaDevices } = this.ensureWebRTC();
    return mediaDevices.getUserMedia({
      audio: true,
      video: mode === 'video',
    }) as unknown as Promise<NativeStream>;
  }

  private async createPeerConnection() {
    const { RTCPeerConnection } = this.ensureWebRTC();
    if (this.pc) {
      (this.pc as { close: () => void }).close();
      this.pc = null;
    }

    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers }) as unknown as {
      addTrack: (track: unknown, stream: NativeStream) => void;
      close: () => void;
      ontrack: ((event: { streams: NativeStream[] }) => void) | null;
      onicecandidate: ((event: { candidate: { toJSON: () => RTCIceCandidateInit } | null }) => void) | null;
      createOffer: () => Promise<RTCSessionDescriptionInit>;
      createAnswer: () => Promise<RTCSessionDescriptionInit>;
      setLocalDescription: (desc: RTCSessionDescriptionInit) => Promise<void>;
      setRemoteDescription: (desc: RTCSessionDescriptionInit) => Promise<void>;
      addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
    };

    this.localStream?.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        this.remoteStream = stream;
        this.emitRemoteStream();
        this.callbacks.onPhase?.('active');
      }
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate || !this.callId) return;
      void this.sendSignal({
        type: 'ice',
        callId: this.callId,
        fromUserId: this.userId,
        candidate: event.candidate.toJSON(),
      });
    };

    this.pc = pc;
    return pc;
  }

  async startCall(mode: CallMode) {
    if (!this.relationshipId || !this.userId) throw new Error('Call channel not ready');

    this.isInitiator = true;
    this.mode = mode;
    this.callId = createCallId();
    this.callbacks.onPhase?.('connecting');

    this.localStream = await this.getUserMedia(mode);
    this.emitLocalStream();

    await this.createPeerConnection();
    const invite = {
      type: 'invite' as const,
      callId: this.callId,
      fromUserId: this.userId,
      fromName: this.userName,
      mode,
    };
    await this.sendSignal(invite);
    // Keep ringing: their app may only open (from the call push) a few seconds from now.
    this.ringTimer = setInterval(() => void this.sendSignal(invite), RING_REPEAT_MS);
    this.ringTimeout = setTimeout(() => {
      this.callbacks.onError?.('No answer');
      void this.endCall();
    }, RING_TIMEOUT_MS);
  }

  private stopRinging() {
    if (this.ringTimer) clearInterval(this.ringTimer);
    if (this.ringTimeout) clearTimeout(this.ringTimeout);
    this.ringTimer = null;
    this.ringTimeout = null;
  }

  /** They picked up: now make the offer (made at accept, so it's never sent to a closed app). */
  private async sendOffer() {
    const pc = this.getPeer() as unknown as {
      createOffer: () => Promise<RTCSessionDescriptionInit>;
      setLocalDescription: (desc: RTCSessionDescriptionInit) => Promise<void>;
    } | null;
    if (!pc || !this.callId) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.sendSignal({ type: 'offer', callId: this.callId, fromUserId: this.userId, sdp: offer });
  }

  async acceptCall(callId: string, mode: CallMode) {
    this.isInitiator = false;
    this.callId = callId;
    this.mode = mode;
    this.callbacks.onPhase?.('connecting');

    this.localStream = await this.getUserMedia(mode);
    this.emitLocalStream();
    await this.createPeerConnection();

    await this.sendSignal({
      type: 'accept',
      callId,
      fromUserId: this.userId,
    });
  }

  async rejectCall(callId: string) {
    await this.sendSignal({ type: 'reject', callId, fromUserId: this.userId });
  }

  private getPeer() {
    return this.pc as {
      setRemoteDescription: (desc: RTCSessionDescriptionInit) => Promise<void>;
      createAnswer: () => Promise<RTCSessionDescriptionInit>;
      setLocalDescription: (desc: RTCSessionDescriptionInit) => Promise<void>;
      addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
      close: () => void;
    } | null;
  }

  private async handleSignal(signal: CallSignal) {
    if (signal.type === 'invite') {
      this.callbacks.onInvite?.(signal);
      return;
    }

    if (this.callId && signal.callId !== this.callId) return;

    const pc = this.getPeer();

    switch (signal.type) {
      case 'accept':
        if (this.isInitiator) {
          this.stopRinging();
          await this.sendOffer();
        }
        break;
      case 'reject':
        this.stopRinging();
        this.callbacks.onPhase?.('ended');
        await this.cleanup();
        break;
      case 'offer': {
        const peer = pc ?? (await this.createPeerConnection());
        await peer.setRemoteDescription(signal.sdp);
        // Either side may re-offer mid-call (switching to video or back), so always answer.
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await this.sendSignal({
          type: 'answer',
          callId: signal.callId,
          fromUserId: this.userId,
          sdp: answer,
        });
        break;
      }
      case 'answer': {
        if (!pc) return;
        await pc.setRemoteDescription(signal.sdp);
        break;
      }
      case 'ice': {
        const peer = pc ?? (await this.createPeerConnection());
        await peer.addIceCandidate(signal.candidate);
        break;
      }
      case 'end':
        this.callbacks.onPhase?.('ended');
        await this.cleanup();
        break;
      case 'camera':
        this.callbacks.onPartnerCamera?.(signal.on);
        break;
      default:
        break;
    }
  }

  toggleMute(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  /**
   * Your own camera, on or off, mid-call (as on Instagram and Snapchat: each person's camera
   * is their own; turning yours on never turns theirs on). On: the camera is added and the
   * call renegotiated. Off: it's stopped and removed (the camera light goes off). Either
   * way the other phone is told, so it shows your video or your photo.
   */
  async setCamera(on: boolean) {
    if (!this.callId) return;
    const mode: CallMode = on ? 'video' : 'audio';
    const hasCamera = (this.localStream?.getVideoTracks().length ?? 0) > 0;
    if (on === hasCamera) {
      await this.sendSignal({ type: 'camera', callId: this.callId, fromUserId: this.userId, on });
      return;
    }
    const pc = this.pc as {
      addTrack: (track: NativeTrack, stream: NativeStream) => Sender;
      removeTrack: (sender: Sender) => void;
      getSenders: () => Sender[];
    } | null;
    if (mode === 'video') {
      const { mediaDevices } = this.ensureWebRTC();
      const camera = (await mediaDevices.getUserMedia({ video: true, audio: false })) as unknown as NativeStream;
      const [track] = camera.getVideoTracks();
      if (track && this.localStream) {
        this.localStream.addTrack?.(track);
        pc?.addTrack(track, this.localStream);
      }
    } else {
      for (const track of this.localStream?.getVideoTracks() ?? []) {
        const sender = pc?.getSenders().find((s) => s.track === track);
        if (sender) pc?.removeTrack(sender);
        track.stop();
        this.localStream?.removeTrack?.(track);
      }
    }
    this.mode = mode;
    this.emitLocalStream();
    await this.sendSignal({ type: 'camera', callId: this.callId, fromUserId: this.userId, on });
    await this.sendOffer();
  }

  /** Front ↔ back camera (react-native-webrtc's own switch on the video track). */
  switchCamera() {
    this.localStream?.getVideoTracks().forEach((track) => {
      (track as unknown as { _switchCamera?: () => void })._switchCamera?.();
    });
  }

  toggleCamera(off: boolean) {
    this.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = !off;
    });
  }

  async endCall() {
    if (this.callId) {
      await this.sendSignal({ type: 'end', callId: this.callId, fromUserId: this.userId });
    }
    this.callbacks.onPhase?.('ended');
    await this.cleanup();
  }

  async cleanup() {
    this.stopRinging();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.remoteStream?.getTracks().forEach((track) => track.stop());
    this.getPeer()?.close();
    this.localStream = null;
    this.remoteStream = null;
    this.pc = null;
    this.callId = null;
    this.emitLocalStream();
    this.emitRemoteStream();
  }
}

export const callManager = new CallManager();
