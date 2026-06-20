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

type Listener = (state: PartnerPresence) => void;

type ManagedPresence = {
  channel: RealtimeChannel;
  partnerId: string;
  userId: string;
  refs: number;
  listeners: Set<Listener>;
  heartbeat: ReturnType<typeof setInterval> | null;
  isOnline: boolean;
  lastSeenAt: string | null;
};

const managedByRelationship = new Map<string, ManagedPresence>();

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

function teardown(relationshipId: string) {
  const entry = managedByRelationship.get(relationshipId);
  if (!entry) return;

  if (entry.heartbeat) clearInterval(entry.heartbeat);
  void entry.channel.untrack();
  supabase.removeChannel(entry.channel);
  managedByRelationship.delete(relationshipId);
}

function ensureManagedChannel(relationshipId: string, userId: string, partnerId: string) {
  const existing = managedByRelationship.get(relationshipId);
  if (existing) {
    existing.refs += 1;
    existing.partnerId = partnerId;
    syncPresence(relationshipId);
    return existing;
  }

  const channel = supabase.channel(`presence:${relationshipId}`, {
    config: { presence: { key: userId } },
  });

  const entry: ManagedPresence = {
    channel,
    partnerId,
    userId,
    refs: 1,
    listeners: new Set(),
    heartbeat: null,
    isOnline: false,
    lastSeenAt: null,
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
        await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        syncPresence(relationshipId);
      }
    });

  entry.heartbeat = setInterval(() => {
    void channel.track({ user_id: userId, online_at: new Date().toISOString() });
  }, 30_000);

  return entry;
}

export function subscribePartnerPresence(
  relationshipId: string,
  userId: string,
  partnerId: string,
  listener: Listener,
): () => void {
  const entry = ensureManagedChannel(relationshipId, userId, partnerId);
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
