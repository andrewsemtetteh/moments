import type { RealtimeChannel } from '@supabase/supabase-js';

import { createCallId, ICE_SERVERS, type CallMode, type CallSignal } from '@/lib/call-types';
import { getWebRTCModule } from '@/lib/webrtc-native';
import { supabase } from '@/lib/supabase';

type NativeStream = {
  getTracks: () => Array<{ stop: () => void; enabled: boolean }>;
  getAudioTracks: () => Array<{ enabled: boolean }>;
  getVideoTracks: () => Array<{ enabled: boolean }>;
  toURL: () => string;
};

export type CallManagerCallbacks = {
  onLocalStream?: (stream: NativeStream | null) => void;
  onRemoteStream?: (stream: NativeStream | null) => void;
  onPhase?: (phase: 'connecting' | 'active' | 'ended') => void;
  onInvite?: (signal: Extract<CallSignal, { type: 'invite' }>) => void;
  onError?: (message: string) => void;
};

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
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }

    const ch = supabase.channel(`call:${relationshipId}`, {
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
      await supabase.removeChannel(this.channel);
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
    }) as Promise<NativeStream>;
  }

  private async createPeerConnection() {
    const { RTCPeerConnection } = this.ensureWebRTC();
    if (this.pc) {
      (this.pc as { close: () => void }).close();
      this.pc = null;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS }) as unknown as {
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

    const pc = await this.createPeerConnection();
    await this.sendSignal({
      type: 'invite',
      callId: this.callId,
      fromUserId: this.userId,
      fromName: this.userName,
      mode,
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.sendSignal({
      type: 'offer',
      callId: this.callId,
      fromUserId: this.userId,
      sdp: offer,
    });
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
        break;
      case 'reject':
        this.callbacks.onPhase?.('ended');
        await this.cleanup();
        break;
      case 'offer': {
        const peer = pc ?? (await this.createPeerConnection());
        await peer.setRemoteDescription(signal.sdp);
        if (this.isInitiator) break;
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
      default:
        break;
    }
  }

  toggleMute(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
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
