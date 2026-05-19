import { Hono } from 'hono';
import { searchEntreprises } from '../lib/entrepriseSearch';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

app.get('/search', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  if (q.length < 4) {
    return c.json({ message: 'Au moins 4 caractères requis pour la recherche.' }, 400);
  }

  try {
    const results = await searchEntreprises(q);
    return c.json({ results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recherche d'entreprises impossible";
    return c.json({ message }, 502);
  }
});

export { app as entreprisesRoutes };
