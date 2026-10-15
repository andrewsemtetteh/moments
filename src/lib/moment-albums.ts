import { useCallback } from 'react';

import { useCoupleDoc } from '@/lib/couple-doc';
import { useAuthStore } from '@/stores';

/**
 * Moment albums ("Lisbon trip", "Date nights"…).
 *
 * Shared between both phones (the couple's "albums" document, see
 * couple-doc.ts): works offline, syncs when online, partner edits arrive live.
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
export const FREE_ALBUM_LIMIT = 3;


/** Where this phone kept albums before they synced (moved up the first time). */
const legacyKey = (relationshipId: string) => `moment-albums:${relationshipId}`;
const NO_ALBUMS: MomentAlbum[] = [];

export function albumCoverId(album: MomentAlbum): string | null {
  return album.coverMomentId ?? album.momentIds[0] ?? null;
}

function newAlbumId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useMomentAlbums() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { data, write } = useCoupleDoc<MomentAlbum[]>('albums', NO_ALBUMS, legacyKey);
  const albums = Array.isArray(data) ? data : NO_ALBUMS;

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
