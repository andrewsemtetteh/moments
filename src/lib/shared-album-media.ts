import { createStorageSignedUrl, extractStoragePath, type StorageImageSize } from '@/lib/storage-cdn';
import type { SharedAlbumItem } from '@/types/database';

const BUCKET = 'shared-album';

export function extractSharedAlbumStoragePath(url: string | null | undefined): string | null {
  return extractStoragePath(url, BUCKET);
}

export async function signSharedAlbumPath(path: string, size: StorageImageSize = 'full') {
  return createStorageSignedUrl(BUCKET, path, { size });
}

export async function hydrateSharedAlbumItem(
  item: SharedAlbumItem,
  size: StorageImageSize = 'full',
): Promise<SharedAlbumItem> {
  const media_url = await signSharedAlbumPath(item.storage_path, size);
  return { ...item, media_url };
}

export async function hydrateSharedAlbumItems(
  items: SharedAlbumItem[],
  size: StorageImageSize = 'full',
): Promise<SharedAlbumItem[]> {
  return Promise.all(items.map((item) => hydrateSharedAlbumItem(item, size)));
}
