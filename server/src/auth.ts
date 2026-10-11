import { verifyToken } from '@clerk/backend';
import type { Context, Next } from 'hono';

import './env';

export type AuthVariables = {
  userId: string;
};

/** Verifies the Clerk session JWT on every request and attaches the caller's user id. */
export async function requireAuth(c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return c.json({ error: 'Missing bearer token' }, 401);
  }

  try {
    const payload = await verifyToken(token, { secretKey: c.env.CLERK_SECRET_KEY });
    c.set('userId', payload.sub);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}
