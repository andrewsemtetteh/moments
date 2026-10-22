// Augments the generated global `Env` interface (worker-configuration.d.ts) with
// secrets that aren't declared in wrangler.jsonc — set via `wrangler secret put`.
export {};

declare global {
  interface Env {
    CLERK_SECRET_KEY: string;
    /** Prototype AI (Gemini 3.1 Flash-Lite). Ignored when OPENAI_API_KEY is set. */
    GEMINI_API_KEY?: string;
    /** Optional Gemini model override, e.g. gemini-2.5-flash for keys that still have access. */
    GEMINI_MODEL?: string;
    /** Production AI (GPT-4o-mini). */
    OPENAI_API_KEY?: string;
    /** Superwall webhook signing secret (whsec_…, from the webhook's details). Verifies the svix-* headers. */
    SUPERWALL_WEBHOOK_SECRET?: string;
    /** Share links (moments.vasemti.com): Apple Team ID for the iOS app-site association. */
    APPLE_TEAM_ID?: string;
    /** Share links: Android signing cert SHA-256 fingerprint(s), comma-separated. */
    ANDROID_CERT_SHA256?: string;
    /** Store pages for people opening a link without the app. */
    APP_STORE_URL?: string;
    PLAY_STORE_URL?: string;
    /** Calls: Cloudflare Realtime TURN key (dashboard > Realtime > TURN). Only the server holds it. */
    TURN_KEY_ID?: string;
    TURN_KEY_API_TOKEN?: string;
    /** Optional: signs private media links (moments, chat). Defaults to one derived from CLERK_SECRET_KEY. */
    MEDIA_SIGNING_SECRET?: string;
    /** Developer tools (e.g. "Pretend Plus is on"): the Clerk user ids allowed, comma-separated. */
    DEV_TOOLS_USER_IDS?: string;
    /** Cloudflare's in-memory rate limiters (wrangler.jsonc › ratelimits): N calls a minute. */
    RL_30_PER_MIN?: RateLimit;
    RL_60_PER_MIN?: RateLimit;
    RL_120_PER_MIN?: RateLimit;
    /** Failed pushes, retried with growing gaps (see push.ts). Optional: without it, the in-app catch-up still sends them. */
    PUSH_QUEUE?: Queue<import('./push').PushRetry>;
  }
}
