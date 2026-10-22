import * as ImagePicker from 'expo-image-picker';
import { create } from 'zustand';

import { getFirstName } from '@/lib/avatar-initial';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

/** A photo or video picked from the phone, waiting to go into an album. */
export type PickedMedia = { uri: string; type: 'photo' | 'video' };

/** How many can be picked in one go. */
export const ALBUM_UPLOAD_MAX = 30;
const MAX_VIDEO_SEC = 60;

/** Pick photos and videos from the library (several at once). */
export async function pickAlbumMedia(limit = ALBUM_UPLOAD_MAX): Promise<PickedMedia[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, limit),
    orderedSelection: true,
    quality: 0.85,
    videoMaxDuration: MAX_VIDEO_SEC,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, type: a.type === 'video' ? 'video' : 'photo' }));
}

type UploadState = {
  /** Album id → progress of the upload running into it. */
  jobs: Record<string, { done: number; failed: number; total: number }>;
};

/** Files uploading side by side (more doesn't make a phone's connection faster). */
const UPLOAD_AT_ONCE = 3;

export const useAlbumUploadStore = create<UploadState>(() => ({ jobs: {} }));

function setJob(albumId: string, job: UploadState['jobs'][string] | null) {
  useAlbumUploadStore.setState((s) => {
    const jobs = { ...s.jobs };
    if (job) jobs[albumId] = job;
    else delete jobs[albumId];
    return { jobs };
  });
}

/**
 * Upload picked media into an album, one at a time: each becomes a moment in your
 * history and is added to the album as soon as it lands. Your partner gets one
 * notification for the batch, not one per photo.
 */
export async function uploadToAlbum(opts: {
  albumId: string;
  albumName: string;
  media: PickedMedia[];
  addMoments: (albumId: string, momentIds: string[]) => void;
  onMomentCreated?: () => void;
}): Promise<{ added: number; failed: number }> {
  const { albumId, albumName, media, addMoments, onMomentCreated } = opts;
  const relationship = useRelationshipStore.getState().relationship;
  const partner = useRelationshipStore.getState().partner;
  const user = useAuthStore.getState().user;
  if (!relationship || !user || media.length === 0) return { added: 0, failed: 0 };

  let done = 0;
  let failed = 0;
  let firstId: string | null = null;
  let firstUrl: string | null = null;
  setJob(albumId, { done, failed, total: media.length });

  // Files go up three at a time (the slow part); each becomes a moment in the order picked,
  // one after another, so the free daily limit and the album order stay right.
  const uploads = media.map(() => null as Promise<string> | null);
  const startUpload = (index: number) => {
    const item = media[index];
    const video = item.type === 'video';
    const path = `${relationship.id}/${user.id}/${Date.now()}-${index}.${video ? 'mp4' : 'jpg'}`;
    const p = api.uploadMomentMedia(path, item.uri, video ? 'video/mp4' : 'image/jpeg');
    p.catch(() => undefined); // Handled below, in order.
    uploads[index] = p;
  };
  for (let k = 0; k < Math.min(UPLOAD_AT_ONCE, media.length); k++) startUpload(k);
  let nextToStart = Math.min(UPLOAD_AT_ONCE, media.length);

  for (const [index, item] of media.entries()) {
    try {
      const mediaUrl = await uploads[index]!;
      // One slot free: start the next file while this one becomes a moment.
      if (nextToStart < media.length) startUpload(nextToStart++);
      // No partner option: skips the per-moment "sent you a moment" notification.
      const moment = await api
        .createMoment(relationship.id, user.id, { type: item.type, media_url: mediaUrl })
        .catch((e: unknown) => {
          // Uploaded but not created (e.g. over today's free moments): remove the file.
          void api.discardMomentUpload(mediaUrl);
          throw e;
        });
      addMoments(albumId, [moment.id]);
      firstId ??= moment.id;
      firstUrl ??= moment.media_url ?? mediaUrl;
      done += 1;
      onMomentCreated?.();
    } catch {
      if (nextToStart < media.length) startUpload(nextToStart++);
      failed += 1;
    }
    setJob(albumId, { done, failed, total: media.length });
  }

  setJob(albumId, null);

  if (done > 0 && partner) {
    const photos = media.filter((m) => m.type === 'photo').length;
    const videos = media.length - photos;
    const what =
      photos && videos
        ? `${done} photos and videos`
        : videos
          ? `${done} video${done === 1 ? '' : 's'}`
          : `${done} photo${done === 1 ? '' : 's'}`;
    void api
      .sendPartnerNotification(
        relationship.id,
        partner.id,
        'moment',
        `${getFirstName(user.name) ?? 'Your partner'} added ${what} to “${albumName}”`,
        { mediaUrl: firstUrl, relatedId: firstId },
      )
      .catch(() => undefined);
  }
  return { added: done, failed };
}
