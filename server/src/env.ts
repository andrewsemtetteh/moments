// Augments the generated global `Env` interface (worker-configuration.d.ts) with
// secrets that aren't declared in wrangler.jsonc — set via `wrangler secret put`.
export {};

declare global {
  interface Env {
    CLERK_SECRET_KEY: string;
    ANTHROPIC_API_KEY?: string;
    /** RevenueCat webhook Authorization value (sent as 'Bearer <secret>'). */
    REVENUECAT_WEBHOOK_SECRET?: string;
  }
}
