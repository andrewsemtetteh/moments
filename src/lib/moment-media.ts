import {
  createStorageSignedUrl,
  extractStoragePath,
  resignStorageUrl,
  type StorageImageSize,
} from '@/lib/storage-cdn';
import type { Moment } from '@/types/database';

const MOMENTS_BUCKET = 'moments';

export function extractMomentsStoragePath(url: string | null | undefined): string | null {
  return extractStoragePath(url, MOMENTS_BUCKET);
}

export async function signMomentsMediaUrl(
  url: string | null | undefined,
  size: StorageImageSize = 'full',
): Promise<string | null> {
  return resignStorageUrl(url, MOMENTS_BUCKET, { size });
}

export async function hydrateMomentMedia(
  moment: Moment,
  size: StorageImageSize = 'full',
): Promise<Moment> {
  if (!moment.media_url) return moment;
  const media_url = await signMomentsMediaUrl(moment.media_url, size);
  return media_url === moment.media_url ? moment : { ...moment, media_url };
}

export async function hydrateMomentsMedia(
  moments: Moment[],
  size: StorageImageSize = 'full',
): Promise<Moment[]> {
  return Promise.all(moments.map((m) => hydrateMomentMedia(m, size)));
}

export async function signMomentsPath(path: string, size: StorageImageSize = 'full') {
  return createStorageSignedUrl(MOMENTS_BUCKET, path, { size });
}
