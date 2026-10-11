export type CallMode = 'audio' | 'video';
export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';

export type CallSignal =
  | { type: 'invite'; callId: string; fromUserId: string; fromName: string; mode: CallMode }
  | { type: 'accept'; callId: string; fromUserId: string }
  | { type: 'reject'; callId: string; fromUserId: string }
  | { type: 'offer'; callId: string; fromUserId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; callId: string; fromUserId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; callId: string; fromUserId: string; candidate: RTCIceCandidateInit }
  | { type: 'end'; callId: string; fromUserId: string };

const TURN_URL = process.env.EXPO_PUBLIC_TURN_URL;

/**
 * STUN alone fails behind symmetric NATs (most cellular networks), so calls and live-room voice
 * silently never connect for many couples. Set EXPO_PUBLIC_TURN_URL (+ _USERNAME / _CREDENTIAL)
 * to relay through a TURN server.
 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  ...(TURN_URL
    ? [
        {
          urls: TURN_URL.split(',').map((u) => u.trim()),
          username: process.env.EXPO_PUBLIC_TURN_USERNAME,
          credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
        } as RTCIceServer,
      ]
    : []),
];

export function createCallId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function callChannelName(relationshipId: string) {
  return `call:${relationshipId}`;
}
