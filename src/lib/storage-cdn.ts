import { supabase } from '@/lib/supabase';

/** Long-lived signed URLs; storage delivery is CDN-backed by Supabase. */
export const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 365 * 5;

export type StorageImageSize = 'thumb' | 'display' | 'full';

type ImageTransform = {
  width?: number;
  height?: number;
  resize?: 'cover' | 'contain' | 'fill';
  quality?: number;
};

const IMAGE_TRANSFORMS: Record<Exclude<StorageImageSize, 'full'>, ImageTransform> = {
  thumb: { width: 256, height: 256, resize: 'cover', quality: 80 },
  display: { width: 1080, quality: 85 },
};

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export function isStorageImagePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
}

/** Extract object path after `/{bucket}/` in a Supabase storage URL. */
export function extractStoragePath(
  url: string | null | undefined,
  bucket: string,
): string | null {
  if (!url) return null;
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  let path = url.slice(idx + marker.length);
  const q = path.indexOf('?');
  if (q >= 0) path = path.slice(0, q);
  return decodeURIComponent(path);
}

/**
 * Create a signed CDN URL. Pass `thumb` only for small avatars; default is full quality.
 * Videos and audio are always served as-is (no transform).
 */
export async function createStorageSignedUrl(
  bucket: string,
  path: string,
  options?: { size?: StorageImageSize; ttlSec?: number },
): Promise<string> {
  const ttl = options?.ttlSec ?? SIGNED_URL_TTL_SEC;
  const size = options?.size ?? 'full';
  const transform =
    size !== 'full' && isStorageImagePath(path) ? IMAGE_TRANSFORMS[size] : undefined;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(
    path,
    ttl,
    transform ? { transform } : undefined,
  );

  if (error || !data?.signedUrl) {
    throw error ?? new Error(`Could not sign storage URL for ${bucket}/${path}`);
  }

  return data.signedUrl;
}

/** Re-sign an existing storage URL, optionally with CDN image transforms. */
export async function resignStorageUrl(
  url: string | null | undefined,
  bucket: string,
  options?: { size?: StorageImageSize; ttlSec?: number },
): Promise<string | null> {
  if (!url) return null;
  const path = extractStoragePath(url, bucket);
  if (!path) return url;

  try {
    return await createStorageSignedUrl(bucket, path, options);
  } catch {
    return url;
  }
}
