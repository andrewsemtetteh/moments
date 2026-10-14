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
  }
}
