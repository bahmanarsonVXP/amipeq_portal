import { Hono, Context } from 'hono';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

async function proxyToBackend(c: Context<{ Bindings: Env }>, path: string) {
  const body = await c.req.json();
  const res = await fetch(`${c.env.BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return c.json(await res.json(), res.status as 200);
}

app.post('/quote', (c) => proxyToBackend(c, '/documents/quote'));
app.post('/duerp', (c) => proxyToBackend(c, '/documents/duerp'));

export { app as documentsRoutes };
