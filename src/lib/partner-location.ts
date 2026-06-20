import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/database';

type Listener = () => void;

type ManagedLocation = {
  channel: RealtimeChannel;
  partnerId: string;
  refs: number;
  listeners: Set<Listener>;
};

const managedByPartner = new Map<string, ManagedLocation>();

function removeChannelByTopic(topic: string) {
  for (const existing of supabase.getChannels()) {
    if (existing.topic === topic) {
      void supabase.removeChannel(existing);
    }
  }
}

async function refreshPartnerProfile(partnerId: string, listeners: Set<Listener>) {
  const { data } = await supabase.from('users').select('*').eq('id', partnerId).maybeSingle();
  if (data) {
    listeners.forEach((listener) => listener());
  }
  return data as UserProfile | null;
}

function teardown(partnerId: string) {
  const entry = managedByPartner.get(partnerId);
  if (!entry) return;
  void supabase.removeChannel(entry.channel);
  managedByPartner.delete(partnerId);
}

export function subscribePartnerLocation(
  partnerId: string,
  onUpdate: () => void,
): () => void {
  const existing = managedByPartner.get(partnerId);
  if (existing) {
    existing.refs += 1;
    existing.listeners.add(onUpdate);
    return () => {
      existing.refs -= 1;
      existing.listeners.delete(onUpdate);
      if (existing.refs <= 0) teardown(partnerId);
    };
  }

  const listeners = new Set<Listener>([onUpdate]);
  const channelName = `partner-location:${partnerId}`;
  removeChannelByTopic(`realtime:${channelName}`);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${partnerId}` },
      () => {
        void refreshPartnerProfile(partnerId, listeners);
      },
    )
    .subscribe();

  managedByPartner.set(partnerId, {
    channel,
    partnerId,
    refs: 1,
    listeners,
  });

  return () => {
    const entry = managedByPartner.get(partnerId);
    if (!entry) return;
    entry.refs -= 1;
    entry.listeners.delete(onUpdate);
    if (entry.refs <= 0) teardown(partnerId);
  };
}

export async function fetchPartnerProfileRow(partnerId: string): Promise<UserProfile | null> {
  const { data } = await supabase.from('users').select('*').eq('id', partnerId).maybeSingle();
  return (data as UserProfile | null) ?? null;
}
