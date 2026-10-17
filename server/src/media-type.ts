/**
 * Works out what an uploaded image really is from its first bytes, so a
 * missing or loose Content-Type ("image/jpg", "application/octet-stream",
 * "image/jpeg; charset=…") never turns a good photo away.
 */

const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/gif': 'gif',
};

/** Content type from the file's own signature, or null if it isn't a known image. */
export function sniffImageType(body: ArrayBuffer): string | null {
  const b = new Uint8Array(body.slice(0, 16));
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'heif', 'mif1', 'msf1'].includes(ascii(8, 12))) {
    return 'image/heic';
  }
  return null;
}

/** "image/JPG; charset=binary" → "image/jpeg"; anything not an image comes back as given. */
export function normalizeContentType(header: string | undefined | null): string {
  const t = (header ?? '').toLowerCase().split(';')[0].trim();
  if (t === 'image/jpg' || t === 'image/pjpeg') return 'image/jpeg';
  if (t === 'image/heif') return 'image/heic';
  return t;
}

/**
 * Types shown inline (photos, videos, voice notes, PDFs). Anything else, and above all
 * HTML, SVG or scripts, is only ever handed over as a download, so an uploaded file can't
 * act as a web page on our domain (phishing, stealing a signed-in session).
 */
const INLINE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'audio/webm',
  'application/pdf',
]);

export function isInlineMediaType(type: string | null | undefined): boolean {
  return INLINE_TYPES.has(normalizeContentType(type));
}

/** The type to store an image as, and its file extension (null if it isn't an image we take). */
export function resolveImageType(body: ArrayBuffer, header: string | undefined | null) {
  const type = sniffImageType(body) ?? normalizeContentType(header);
  const ext = IMAGE_EXT[type];
  return ext ? { contentType: type, ext } : null;
}
