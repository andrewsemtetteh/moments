/**
 * Realtime tickets. A WebSocket can't carry a header, so the app used to put its sign-in token in
 * the address, where request logs keep it. Now it first asks for a ticket (signed here, good for
 * 60 seconds, for one space's realtime only) and opens the socket with that: a ticket in a log
 * can't call the API, and it's useless a minute later.
 */

const TICKET_SECONDS = 60;

let cachedKey: { secret: string; key: CryptoKey } | null = null;

async function ticketKey(env: Env): Promise<CryptoKey> {
  // Its own key, derived apart from the media one, from secrets that never leave the server.
  const secret = `ws-ticket:${env.MEDIA_SIGNING_SECRET || env.CLERK_SECRET_KEY}`;
  if (cachedKey?.secret === secret) return cachedKey.key;
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  cachedKey = { secret, key };
  return key;
}

function toBase64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

/** A ticket for this person to open this space's realtime, for the next minute. */
export async function issueWsTicket(env: Env, userId: string, relationshipId: string): Promise<string> {
  const payload = `${userId}.${relationshipId}.${Math.floor(Date.now() / 1000) + TICKET_SECONDS}`;
  const mac = await crypto.subtle.sign('HMAC', await ticketKey(env), new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(mac)}`;
}

/** Who a ticket is for, when it's genuine, unexpired and for this space; null otherwise. */
export async function verifyWsTicket(env: Env, ticket: string, relationshipId: string): Promise<string | null> {
  const parts = ticket.split('.');
  if (parts.length !== 4) return null;
  const [userId, relId, exp, sig] = parts;
  if (relId !== relationshipId || !userId) return null;
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return null;
  const mac = fromBase64Url(sig);
  if (!mac) return null;
  // verify() compares in constant time.
  const ok = await crypto.subtle.verify('HMAC', await ticketKey(env), mac, new TextEncoder().encode(`${userId}.${relId}.${exp}`));
  return ok ? userId : null;
}
