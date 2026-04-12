import type { Context, Next } from 'hono';
import { verifyToken } from '../lib/jwt';
import type { Env } from '../index';

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: { user: any } }>,
  next: Next
) {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = await verifyToken(auth.slice(7), c.env.SUPABASE_JWT_SECRET);
  if (!user) return c.json({ error: 'Invalid token' }, 401);

  c.set('user', user);
  await next();
}
