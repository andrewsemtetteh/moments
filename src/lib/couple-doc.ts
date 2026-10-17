import { useAuth } from '@clerk/expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { backend } from '@/lib/backend';
import { getCoupleDoc, putCoupleDoc } from '@/lib/moments-api';
import { reportError } from '@/lib/monitoring';
import { useAuthStore, useRelationshipStore } from '@/stores';

type Kind = 'albums' | 'places' | 'lists';
type Local<T> = { data: T; version: number; dirty?: boolean };

const cacheKey = (kind: Kind, relationshipId: string) => `couple-doc:${kind}:${relationshipId}`;
const queryKey = (kind: Kind, relationshipId: string | undefined) => ['couple-doc', relationshipId, kind] as const;

async function readLocal<T>(kind: Kind, relationshipId: string): Promise<Local<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(kind, relationshipId));
    return raw ? (JSON.parse(raw) as Local<T>) : null;
  } catch {
    return null;
  }
}
function writeLocal<T>(kind: Kind, relationshipId: string, value: Local<T>) {
  void AsyncStorage.setItem(cacheKey(kind, relationshipId), JSON.stringify(value)).catch(() => undefined);
}

/** One save at a time per document, so two quick edits can't race each other. */
const queues = new Map<string, Promise<unknown>>();
function enqueue(key: string, task: () => Promise<void>) {
  const next = (queues.get(key) ?? Promise.resolve()).then(task, task);
  queues.set(key, next.catch(() => undefined));
  return next;
}

/**
 * A small document the couple shares (albums, place names), synced between
 * both phones. Offline-first: reads and edits work from this phone's copy and
 * sync when there's a connection. Edits are applied as functions, so if the
 * other phone saved first the change is simply reapplied on the latest copy
 * (no lost edits). The partner's edits arrive live.
 *
 * `legacyKey` is where this phone kept the data before syncing existed; it's
 * moved up to the server the first time.
 */
export function useCoupleDoc<T>(kind: Kind, empty: T, legacyKey?: (relationshipId: string) => string) {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const userId = useAuthStore((s) => s.user?.id);
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const key = queryKey(kind, relationshipId);

  const { data: doc } = useQuery({
    queryKey: key,
    enabled: !!relationshipId,
    staleTime: 30_000,
    queryFn: async (): Promise<Local<T>> => {
      const relId = relationshipId!;
      const local = await readLocal<T>(kind, relId);
      let legacy: T | null = null;
      if (!local && legacyKey) {
        try {
          const raw = await AsyncStorage.getItem(legacyKey(relId));
          legacy = raw ? (JSON.parse(raw) as T) : null;
        } catch {
          legacy = null;
        }
      }
      try {
        const token = await getToken();
        if (!token) throw new Error('signed out');
        const remote = await getCoupleDoc<T>(token, relId, kind);
        // This phone has edits (or old data) the server hasn't seen: send them up.
        const pending = local?.dirty ? local.data : remote.data == null ? (local?.data ?? legacy) : null;
        if (pending != null) {
          const saved = await putCoupleDoc(token, relId, kind, pending, remote.version);
          const value: Local<T> = { data: (saved.data ?? empty) as T, version: saved.version };
          writeLocal(kind, relId, value);
          return value;
        }
        const value: Local<T> = { data: (remote.data ?? empty) as T, version: remote.version };
        writeLocal(kind, relId, value);
        return value;
      } catch {
        // Offline (or the server is behind): carry on with this phone's copy.
        return local ?? { data: legacy ?? empty, version: 0 };
      }
    },
  });

  /** Apply an edit here straight away, then save it (reapplying on a clash). */
  const write = useCallback(
    (update: (current: T) => T) => {
      if (!relationshipId) return;
      const relId = relationshipId;
      const current = queryClient.getQueryData<Local<T>>(queryKey(kind, relId)) ?? { data: empty, version: 0 };
      const optimistic: Local<T> = { data: update(current.data), version: current.version, dirty: true };
      queryClient.setQueryData(queryKey(kind, relId), optimistic);
      writeLocal(kind, relId, optimistic);

      void enqueue(`${kind}:${relId}`, async () => {
        try {
          const token = await getToken();
          if (!token) return;
          let base = queryClient.getQueryData<Local<T>>(queryKey(kind, relId)) ?? optimistic;
          let data = base.data;
          for (let attempt = 0; attempt < 4; attempt++) {
            const res = await putCoupleDoc(token, relId, kind, data, base.version);
            if (!res.conflict) {
              const saved: Local<T> = { data: (res.data ?? empty) as T, version: res.version };
              queryClient.setQueryData(queryKey(kind, relId), saved);
              writeLocal(kind, relId, saved);
              return;
            }
            // The other phone saved first: reapply this edit on top of theirs.
            base = { data: (res.data ?? empty) as T, version: res.version };
            data = update(base.data);
          }
        } catch (e) {
          // Offline: it stays marked as unsaved and goes up on the next sync.
          if (e instanceof Error && !/Network|fetch/i.test(e.message)) reportError(e, { where: `couple-doc:${kind}` });
        }
      });
    },
    [empty, getToken, kind, queryClient, relationshipId],
  );

  // The partner's edits arrive live.
  useEffect(() => {
    if (!relationshipId) return;
    const channel = backend
      .channel(`relationship:${relationshipId}:couple_docs:${kind}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'couple_docs', filter: `relationship_id=eq.${relationshipId}` },
        (payload: unknown) => {
          const row = (payload as { new?: { kind?: string; updated_by?: string } } | null)?.new;
          if (row?.kind === kind && row.updated_by !== userId) {
            void queryClient.invalidateQueries({ queryKey: queryKey(kind, relationshipId) });
          }
        },
      )
      .subscribe();
    return () => {
      void backend.removeChannel(channel);
    };
  }, [kind, queryClient, relationshipId, userId]);

  return { data: doc?.data ?? empty, write };
}
