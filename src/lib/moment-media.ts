import { supabase } from '@/lib/supabase';
import type { Moment } from '@/types/database';

const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 365 * 5;

/** Extract `{relationshipId}/{userId}/{file}` path from a Supabase moments storage URL. */
export function extractMomentsStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = '/moments/';
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  let path = url.slice(idx + marker.length);
  const q = path.indexOf('?');
  if (q >= 0) path = path.slice(0, q);
  return decodeURIComponent(path);
}

export async function signMomentsMediaUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const path = extractMomentsStoragePath(url);
  if (!path) return url;

  const { data, error } = await supabase.storage.from('moments').createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return url;
  return data.signedUrl;
}

export async function hydrateMomentMedia(moment: Moment): Promise<Moment> {
  if (!moment.media_url) return moment;
  const media_url = await signMomentsMediaUrl(moment.media_url);
  return media_url === moment.media_url ? moment : { ...moment, media_url };
}

export async function hydrateMomentsMedia(moments: Moment[]): Promise<Moment[]> {
  return Promise.all(moments.map((m) => hydrateMomentMedia(m)));
}
