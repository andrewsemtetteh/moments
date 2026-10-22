import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The running request's ExecutionContext, so deep helpers (notifications, realtime) can finish
 * slow side work — a push to the partner's phone, the realtime ping — after the answer has gone
 * back, instead of making the person wait for it.
 */
/** All that's needed from the request's context (Hono's and the runtime's types differ). */
type WaitContext = { waitUntil(promise: Promise<unknown>): void };

const store = new AsyncLocalStorage<WaitContext>();

export function runWithContext<T>(ctx: WaitContext | undefined, fn: () => T): T {
  return ctx ? store.run(ctx, fn) : fn();
}

/**
 * Side work that the answer doesn't depend on: runs after the response (waitUntil) when there's
 * a request to attach it to; otherwise (cron, tests) it's simply awaited.
 */
export async function afterResponse(task: Promise<unknown>): Promise<void> {
  const ctx = store.getStore();
  const safe = task.catch((e) => console.warn('[after-response] failed', e));
  if (ctx) ctx.waitUntil(safe);
  else await safe;
}
