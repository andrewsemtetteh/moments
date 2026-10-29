import type { MiddlewareHandler } from 'hono';

import type { AuthVariables } from './auth';
import { ApiError, consumeRateLimit } from './core';

/**
 * Per-user rate limit for one route: at most `max` calls per `windowSeconds`.
 * Over the limit answers 429, so a buggy client or a script can't flood
 * writes, uploads, or guess invite codes.
 */
/** The caller's address (Cloudflare sets it; it can't be faked from outside). */
export function clientIp(c: { req: { header(name: string): string | undefined } }): string {
  return c.req.header('CF-Connecting-IP') ?? 'unknown';
}

/**
 * Per-address limit, for what happens before (or alongside) sign-in: opening realtime, trying
 * invite codes from many accounts at one address.
 */
export function ipRateLimit(name: string, max: number, windowSeconds: number): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    try {
      await consumeRateLimit(c.env, `${name}:ip:${clientIp(c)}`, max, windowSeconds);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) return c.json({ error: e.message }, 429);
      throw e;
    }
    await next();
  };
}

export function rateLimit(
  name: string,
  max: number,
  windowSeconds: number,
): MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> {
  return async (c, next) => {
    try {
      await consumeRateLimit(c.env, `${name}:${c.get('userId')}`, max, windowSeconds);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) return c.json({ error: e.message }, 429);
      throw e;
    }
    await next();
  };
}
