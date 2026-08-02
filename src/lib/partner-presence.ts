import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

interface PresencePayload {
  user_id: string;
  online_at: string;
}

export interface PartnerPresence {
  isOnline: boolean;
  lastSeenAt: string | null;
}

export type SubscribePresenceOptions = {
  /** When false, this device does not broadcast online presence. */
  shareOnlineStatus?: boolean;
};

type Listener = (state: PartnerPresence) => void;

type ManagedPresence = {
  channel: RealtimeChannel;
  partnerId: string;
  userId: string;
  shareOnlineStatus: boolean;
  refs: number;
  listeners: Set<Listener>;
  heartbeat: ReturnType<typeof setInterval> | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  lastTouchAt: number;
};

const managedByRelationship = new Map<string, ManagedPresence>();
const TOUCH_MIN_MS = 60_000;

function isPartnerPresent(state: Record<string, PresencePayload[]>, partnerId: string): boolean {
  return Object.values(state).some((presences) =>
    presences.some((presence) => presence.user_id === partnerId),
  );
}

function emit(relationshipId: string) {
  const entry = managedByRelationship.get(relationshipId);
  if (!entry) return;

  const snapshot: PartnerPresence = {
    isOnline: entry.isOnline,
    lastSeenAt: entry.lastSeenAt,
  };

  entry.listeners.forEach((listener) => listener(snapshot));
}

function syncPresence(relationshipId: string) {
  const entry = managedByRelationship.get(relationshipId);
  if (!entry) return;

  const state = entry.channel.presenceState<PresencePayload>();
  entry.isOnline = isPartnerPresent(state, entry.partnerId);
  emit(relationshipId);
}

async function touchLastSeenDb(userId: string, entry: ManagedPresence) {
  const now = Date.now();
  if (now - entry.lastTouchAt < TOUCH_MIN_MS) return;
  entry.lastTouchAt = now;
  try {
    const { touchLastSeen } = await import('@/services/api');
    await touchLastSeen(userId);
  } catch {
    // Non-blocking — presence UI still works from the channel.
  }
}

async function trackSelf(entry: ManagedPresence) {
  if (!entry.shareOnlineStatus) {
    await entry.channel.untrack();
    return;
  }
  const onlineAt = new Date().toISOString();
  await entry.channel.track({ user_id: entry.userId, online_at: onlineAt });
  void touchLastSeenDb(entry.userId, entry);
}

function teardown(relationshipId: string) {
  const entry = managedByRelationship.get(relationshipId);
  if (!entry) return;

  if (entry.heartbeat) clearInterval(entry.heartbeat);
  void entry.channel.untrack();
  supabase.removeChannel(entry.channel);
  managedByRelationship.delete(relationshipId);
}

function ensureManagedChannel(
  relationshipId: string,
  userId: string,
  partnerId: string,
  shareOnlineStatus: boolean,
) {
  const existing = managedByRelationship.get(relationshipId);
  if (existing) {
    existing.refs += 1;
    existing.partnerId = partnerId;
    if (existing.shareOnlineStatus !== shareOnlineStatus) {
      existing.shareOnlineStatus = shareOnlineStatus;
      void trackSelf(existing).then(() => syncPresence(relationshipId));
    } else {
      syncPresence(relationshipId);
    }
    return existing;
  }

  const channel = supabase.channel(`presence:${relationshipId}`, {
    config: { presence: { key: userId } },
  });

  const entry: ManagedPresence = {
    channel,
    partnerId,
    userId,
    shareOnlineStatus,
    refs: 1,
    listeners: new Set(),
    heartbeat: null,
    isOnline: false,
    lastSeenAt: null,
    lastTouchAt: 0,
  };

  managedByRelationship.set(relationshipId, entry);

  channel
    .on('presence', { event: 'sync' }, () => syncPresence(relationshipId))
    .on('presence', { event: 'join' }, () => syncPresence(relationshipId))
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      const partnerLeft = leftPresences.some((presence) => presence.user_id === entry.partnerId);
      if (partnerLeft) {
        const seenAt = leftPresences.find((presence) => presence.user_id === entry.partnerId)?.online_at;
        entry.lastSeenAt = seenAt ?? new Date().toISOString();
      }
      syncPresence(relationshipId);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await trackSelf(entry);
        syncPresence(relationshipId);
      }
    });

  entry.heartbeat = setInterval(() => {
    void trackSelf(entry);
  }, 30_000);

  return entry;
}

export function subscribePartnerPresence(
  relationshipId: string,
  userId: string,
  partnerId: string,
  listener: Listener,
  options: SubscribePresenceOptions = {},
): () => void {
  const shareOnlineStatus = options.shareOnlineStatus !== false;
  const entry = ensureManagedChannel(relationshipId, userId, partnerId, shareOnlineStatus);
  entry.listeners.add(listener);
  listener({ isOnline: entry.isOnline, lastSeenAt: entry.lastSeenAt });

  return () => {
    entry.listeners.delete(listener);
    entry.refs -= 1;
    if (entry.refs <= 0) {
      teardown(relationshipId);
    }
  };
}

/** Update whether this device broadcasts presence (e.g. after toggling in Settings). */
export function setLocalOnlineStatusSharing(relationshipId: string, shareOnlineStatus: boolean) {
  const entry = managedByRelationship.get(relationshipId);
  if (!entry || entry.shareOnlineStatus === shareOnlineStatus) return;
  entry.shareOnlineStatus = shareOnlineStatus;
  void trackSelf(entry).then(() => syncPresence(relationshipId));
}
