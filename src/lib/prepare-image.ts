import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Photo types we re-encode before upload (GIFs keep their animation, so they're left alone). */
const CONVERTIBLE = new Set(['image/jpeg', 'image/jpg', 'image/heic', 'image/heif', 'image/png', 'image/webp']);

export function isConvertiblePhoto(contentType: string | null | undefined) {
  return !!contentType && CONVERTIBLE.has(contentType.toLowerCase().split(';')[0].trim());
}

/**
 * Turns any picked or captured photo into a plain JPEG file before upload.
 *
 * - iPhone photos are often HEIC, which Android (and some browsers) can't show,
 *   and file names don't reliably say what the bytes are. A real JPEG fixes both.
 * - Android hands back content:// URIs that a plain fetch can fail to read;
 *   the result here is always a local file.
 * - Big camera photos are scaled so the longest side is at most `maxSide`.
 *
 * If conversion fails for any reason, the original is used as is.
 */
export async function prepareImageForUpload(
  uri: string,
  { maxSide = 2048, quality = 0.82 }: { maxSide?: number; quality?: number } = {},
): Promise<{ uri: string; contentType: string }> {
  try {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    let image = original;
    const longest = Math.max(original.width, original.height);
    if (longest > maxSide) {
      const scale = maxSide / longest;
      image = await ImageManipulator.manipulate(original)
        .resize({ width: Math.round(original.width * scale), height: Math.round(original.height * scale) })
        .renderAsync();
    }
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
    return { uri: saved.uri, contentType: 'image/jpeg' };
  } catch {
    return { uri, contentType: 'image/jpeg' };
  }
}

/** Reads a local file into bytes for upload. */
export async function readUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}
