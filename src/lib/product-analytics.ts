import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';

/**
 * Product analytics (PostHog): which screens and features get used, the paywall funnel,
 * retention. Privacy first:
 * - only an opaque account id (never a name, email, photo or message);
 * - event properties never carry free text people typed (see SAFE_PROPS);
 * - off in development unless EXPO_PUBLIC_POSTHOG_IN_DEV=1, and off with no key.
 */
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const ON = !!KEY && (!__DEV__ || process.env.EXPO_PUBLIC_POSTHOG_IN_DEV === '1');

let client: PostHog | null = null;

export function initProductAnalytics(): PostHog | null {
  if (!ON || client) return client;
  client = new PostHog(KEY, {
    host: HOST,
    // We send our own named events; no automatic tap capture (it can pick up text on screen).
    captureAppLifecycleEvents: true,
    flushAt: 20,
    flushInterval: 15_000,
    // No session recording: chats and moments are private.
    enableSessionReplay: false,
    personProfiles: 'identified_only',
  });
  void client.register({
    app_version: Constants.expoConfig?.version ?? '0.0.0',
  });
  return client;
}

/** Tie events to the account (its id only), or forget it on sign-out. */
export function identifyAnalyticsUser(userId: string | null, traits?: { plus?: boolean; paired?: boolean }) {
  if (!client) return;
  if (userId) client.identify(userId, traits ? { plus: !!traits.plus, paired: !!traits.paired } : undefined);
  else void client.reset();
}

/** A screen view (the route's path, e.g. "/chat"; ids stripped so it groups well). */
export function trackScreen(pathname: string) {
  if (!client) return;
  const name = pathname.replace(/\/[0-9a-f-]{8,}(?=\/|$)/gi, '/[id]') || '/';
  void client.screen(name);
}

/** Properties that are safe to send: numbers, booleans and short known labels. Never typed text. */
const BLOCKED = new Set(['text', 'content', 'message', 'note', 'body', 'caption', 'name', 'email', 'title', 'prompt', 'answer']);
function safeProps(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (BLOCKED.has(k)) continue;
    if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v;
    else if (typeof v === 'string' && v.length <= 40) out[k] = v;
  }
  return out;
}

/** An app event (also stored on our own server by services/analytics). */
export function captureEvent(event: string, metadata?: Record<string, unknown>) {
  if (!client) return;
  client.capture(event, safeProps(metadata));
}

/**
 * A PostHog experiment's variant for this person ("control", "prices-first"…), or undefined
 * when analytics is off or flags haven't loaded (callers fall back to control). Reading it
 * records the exposure PostHog's experiment results count.
 */
export function getFlagVariant(key: string): string | undefined {
  if (!client) return undefined;
  const value = client.getFeatureFlag(key);
  return typeof value === 'string' ? value : undefined;
}

export { safeProps as _safePropsForTests };
