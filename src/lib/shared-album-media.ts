import { supabase } from '@/lib/supabase';
import type { SharedAlbumItem } from '@/types/database';

const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 365 * 5;
const BUCKET = 'shared-album';

export function extractSharedAlbumStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  let path = url.slice(idx + marker.length);
  const q = path.indexOf('?');
  if (q >= 0) path = path.slice(0, q);
  return decodeURIComponent(path);
}

export async function signSharedAlbumPath(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not sign album URL');
  return data.signedUrl;
}

export async function hydrateSharedAlbumItem(item: SharedAlbumItem): Promise<SharedAlbumItem> {
  const media_url = await signSharedAlbumPath(item.storage_path);
  return { ...item, media_url };
}

export async function hydrateSharedAlbumItems(items: SharedAlbumItem[]): Promise<SharedAlbumItem[]> {
  return Promise.all(items.map((item) => hydrateSharedAlbumItem(item)));
}
