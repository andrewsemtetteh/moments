/**
 * Private media links. Moment and chat files are only served with a signature that
 * expires (`?e=<unix seconds>&s=<sig>`), so a link that leaks stops working within two
 * weeks, and guessing a file's address gets nothing. The server signs every moment/chat
 * file URL it sends out (database reads, functions, realtime), so the app never builds one.
 * Avatars stay public.
 */

const WEEK_SECONDS = 7 * 24 * 3600;
/** Matches our moment/chat file URLs, with or without an old signature, inside any text (JSON too). */
const MEDIA_URL = /(https?:\/\/[^\s"'\\]+?\/media\/((?:moments|chat)\/[^\s"'\\?#]+))(?:\?[^\s"'\\#]*)?/g;

let cachedKey: { secret: string; key: CryptoKey } | null = null;

async function signingKey(env: Env): Promise<CryptoKey> {
  // Derived from the server's Clerk secret (never leaves the server); a dedicated
  // MEDIA_SIGNING_SECRET takes over if one is set.
  const secret = env.MEDIA_SIGNING_SECRET || `media-sign:${env.CLERK_SECRET_KEY}`;
  if (cachedKey?.secret === secret) return cachedKey.key;
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  cachedKey = { secret, key };
  return key;
}

function toBase64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function signature(env: Env, key: string, expires: number): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', await signingKey(env), new TextEncoder().encode(`${key}\n${expires}`));
  return toBase64Url(mac).slice(0, 32);
}

/**
 * When links signed now expire: the end of next week. The same for a whole week, so a
 * photo's URL doesn't change on every load and stays cached on the phone.
 */
function currentExpiry(): number {
  const now = Math.floor(Date.now() / 1000);
  return (Math.floor(now / WEEK_SECONDS) + 2) * WEEK_SECONDS;
}

export function isPrivateMediaKey(key: string): boolean {
  return key.startsWith('moments/') || key.startsWith('chat/');
}

/** A signed URL for one stored file (bucket/path), for the app to show right away. */
export async function signedMediaUrl(env: Env, origin: string, key: string): Promise<string> {
  const e = currentExpiry();
  const path = key.split('/').map(encodeURIComponent).join('/');
  return `${origin}/media/${path}?e=${e}&s=${await signature(env, decodeURIComponent(key), e)}`;
}

/** Whether a /media request carries a valid, unexpired signature. */
export async function verifyMediaSignature(env: Env, key: string, e: string | undefined, s: string | undefined) {
  const expires = Number(e);
  if (!s || !Number.isFinite(expires) || expires * 1000 < Date.now()) return false;
  const expected = await signature(env, key, expires);
  if (expected.length !== s.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ s.charCodeAt(i);
  return diff === 0;
}

/** Re-signs every moment/chat file URL found in a piece of text (a JSON body, a message…). */
export async function signMediaInText(env: Env, text: string): Promise<string> {
  MEDIA_URL.lastIndex = 0;
  if (!MEDIA_URL.test(text)) return text;
  MEDIA_URL.lastIndex = 0;
  const e = currentExpiry();
  const found = new Map<string, string>();
  for (const m of text.matchAll(MEDIA_URL)) {
    const [whole, base, path] = m;
    if (found.has(whole)) continue;
    const key = decodeURIComponent(path);
    found.set(whole, `${base}?e=${e}&s=${await signature(env, key, e)}`);
  }
  return text.replace(MEDIA_URL, (whole) => found.get(whole) ?? whole);
}

/** Same, for a value about to be sent as JSON (realtime events). */
export async function signMediaInValue<T>(env: Env, value: T): Promise<T> {
  const text = JSON.stringify(value);
  const signed = await signMediaInText(env, text);
  return signed === text ? value : (JSON.parse(signed) as T);
}
