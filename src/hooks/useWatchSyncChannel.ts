import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type MediaSyncAction = 'PLAY' | 'PAUSE' | 'SEEK';

export interface MediaSyncPayload {
  action: MediaSyncAction;
  timestamp: number;
  senderId: string;
  sentAt: number;
}

export function useWatchSyncChannel(
  sessionId: string | undefined,
  userId: string | undefined,
  onSync: (payload: MediaSyncPayload) => void,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isIncomingSync = useRef(false);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    if (!sessionId || !userId) return;

    const channel = supabase.channel(`watch_session:${sessionId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'media_sync' }, ({ payload }) => {
        const data = payload as MediaSyncPayload;
        if (!data || data.senderId === userId) return;

        isIncomingSync.current = true;
        onSyncRef.current(data);

        setTimeout(() => {
          isIncomingSync.current = false;
        }, 300);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [sessionId, userId]);

  const broadcast = useCallback(
    (action: MediaSyncAction, timestamp: number) => {
      if (isIncomingSync.current || !channelRef.current || !userId) return;

      channelRef.current.send({
        type: 'broadcast',
        event: 'media_sync',
        payload: {
          action,
          timestamp,
          senderId: userId,
          sentAt: Date.now(),
        } satisfies MediaSyncPayload,
      });
    },
    [userId],
  );

  const withIncomingLock = useCallback((fn: () => void) => {
    if (isIncomingSync.current) return;
    fn();
  }, []);

  return { broadcast, isIncomingSync, withIncomingLock };
}

/** Apply network-flight drift correction on incoming SEEK events. */
export function correctedSeekTime(payload: MediaSyncPayload): number {
  const drift = (Date.now() - payload.sentAt) / 1000;
  return Math.max(0, payload.timestamp + drift);
}
