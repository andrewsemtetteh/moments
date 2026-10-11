import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuthStore, useRelationshipStore } from '@/stores';

/**
 * Moment albums ("Lisbon trip", "Date nights"…).
 *
 * Stored on the device for now (like Plan lists, see plan-local.ts) so the
 * design can be tried out before it gets a backend table and syncs to the
 * partner's phone.
 */
export type MomentAlbum = {
  id: string;
  name: string;
  emoji: string;
  /** Newest first — the order moments were added. */
  momentIds: string[];
  /** Falls back to the most recently added moment when unset. */
  coverMomentId: string | null;
  createdAt: string;
  createdBy: string | null;
};

/** Free accounts get this many albums; Plus is unlimited. */
export const FREE_ALBUM_LIMIT = 2;

export const ALBUM_EMOJIS = ['💞', '✈️', '🍝', '🌅', '🎉', '🏡', '📸', '🎄', '🌸', '🐾'] as const;
export const ALBUM_NAME_IDEAS = ['Date nights', 'Our trips', 'Our firsts', 'Just us', 'Food we loved'] as const;

const storageKey = (relationshipId: string) => `moment-albums:${relationshipId}`;
const queryKey = (relationshipId: string | undefined) => ['moment-albums', relationshipId] as const;

async function loadAlbums(relationshipId: string): Promise<MomentAlbum[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(relationshipId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as MomentAlbum[]) : [];
  } catch {
    return [];
  }
}

export function albumCoverId(album: MomentAlbum): string | null {
  return album.coverMomentId ?? album.momentIds[0] ?? null;
}

function newAlbumId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useMomentAlbums() {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const queryClient = useQueryClient();

  const { data: albums = [] } = useQuery({
    queryKey: queryKey(relationshipId),
    queryFn: () => loadAlbums(relationshipId!),
    enabled: !!relationshipId,
    staleTime: Infinity,
  });

  const write = useCallback(
    (update: (current: MomentAlbum[]) => MomentAlbum[]) => {
      if (!relationshipId) return;
      const current = queryClient.getQueryData<MomentAlbum[]>(queryKey(relationshipId)) ?? [];
      const next = update(current);
      queryClient.setQueryData(queryKey(relationshipId), next);
      void AsyncStorage.setItem(storageKey(relationshipId), JSON.stringify(next));
    },
    [queryClient, relationshipId],
  );

  const createAlbum = useCallback(
    (input: { name: string; emoji: string; momentIds?: string[] }): MomentAlbum => {
      const album: MomentAlbum = {
        id: newAlbumId(),
        name: input.name.trim(),
        emoji: input.emoji,
        momentIds: input.momentIds ?? [],
        coverMomentId: null,
        createdAt: new Date().toISOString(),
        createdBy: userId,
      };
      write((current) => [album, ...current]);
      return album;
    },
    [userId, write],
  );

  const addMoments = useCallback(
    (albumId: string, momentIds: string[]) =>
      write((current) =>
        current.map((a) =>
          a.id === albumId
            ? { ...a, momentIds: [...momentIds.filter((id) => !a.momentIds.includes(id)), ...a.momentIds] }
            : a,
        ),
      ),
    [write],
  );

  const removeMoment = useCallback(
    (albumId: string, momentId: string) =>
      write((current) =>
        current.map((a) =>
          a.id === albumId
            ? {
                ...a,
                momentIds: a.momentIds.filter((id) => id !== momentId),
                coverMomentId: a.coverMomentId === momentId ? null : a.coverMomentId,
              }
            : a,
        ),
      ),
    [write],
  );

  /** After moments are deleted, drop them from every album so counts stay right. */
  const pruneMoments = useCallback(
    (momentIds: string[]) =>
      write((current) =>
        current.map((a) => ({
          ...a,
          momentIds: a.momentIds.filter((id) => !momentIds.includes(id)),
          coverMomentId: a.coverMomentId && momentIds.includes(a.coverMomentId) ? null : a.coverMomentId,
        })),
      ),
    [write],
  );

  const setCover = useCallback(
    (albumId: string, momentId: string) =>
      write((current) => current.map((a) => (a.id === albumId ? { ...a, coverMomentId: momentId } : a))),
    [write],
  );

  const updateAlbum = useCallback(
    (albumId: string, patch: { name?: string; emoji?: string }) =>
      write((current) =>
        current.map((a) =>
          a.id === albumId ? { ...a, ...patch, name: (patch.name ?? a.name).trim() } : a,
        ),
      ),
    [write],
  );

  const deleteAlbum = useCallback(
    (albumId: string) => write((current) => current.filter((a) => a.id !== albumId)),
    [write],
  );

  return { albums, createAlbum, addMoments, removeMoment, pruneMoments, setCover, updateAlbum, deleteAlbum };
}
