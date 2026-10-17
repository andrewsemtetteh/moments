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

/** Used until (or if) the relay servers can't be fetched: direct connections only. */
const STUN_FALLBACK: RTCIceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];

let cached: { servers: RTCIceServer[]; until: number } | null = null;
let inflight: Promise<RTCIceServer[]> | null = null;

/**
 * STUN alone fails behind symmetric NATs (most cellular networks), so calls and live-room voice
 * need a TURN relay too. Its credentials are short-lived and come from the server per person
 * (server/src/functions.ts `ice-servers`); nothing secret is built into the app.
 */
export function getIceServers(): Promise<RTCIceServer[]> {
  if (cached && cached.until > Date.now()) return Promise.resolve(cached.servers);
  inflight ??= (async () => {
    try {
      const { backend } = await import('@/lib/backend');
      const { data, error } = await backend.functions.invoke('ice-servers', { body: {} });
      const result = data as { iceServers?: RTCIceServer[]; ttl?: number } | null;
      if (error || !result?.iceServers?.length) return STUN_FALLBACK;
      // Refresh well before the credentials expire.
      cached = { servers: result.iceServers, until: Date.now() + Math.max(60, (result.ttl ?? 600) - 600) * 1000 };
      return result.iceServers;
    } catch {
      return STUN_FALLBACK;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** The last fetched servers (or the fallback), for code that can't wait. Call getIceServers() first. */
export function currentIceServers(): RTCIceServer[] {
  return cached && cached.until > Date.now() ? cached.servers : STUN_FALLBACK;
}

export function createCallId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function callChannelName(relationshipId: string) {
  return `call:${relationshipId}`;
}
