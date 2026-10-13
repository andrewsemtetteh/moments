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
    /** RevenueCat webhook Authorization value (sent as 'Bearer <secret>'). */
    REVENUECAT_WEBHOOK_SECRET?: string;
    /** RevenueCat's HMAC signing secret (shown once when signing is enabled). Verifies X-RevenueCat-Webhook-Signature. */
    REVENUECAT_WEBHOOK_SIGNING_SECRET?: string;
  }
}
