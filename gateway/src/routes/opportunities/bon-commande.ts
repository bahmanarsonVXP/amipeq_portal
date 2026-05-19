import { Hono } from 'hono';
import {
  patchToGraphqlDataLines,
  updateOpportunityViaGraphql,
} from '../../lib/opportunityGraphql';
import type { Env } from '../../index';

const app = new Hono<{ Bindings: Env }>();

app.patch('/:id/bon-commande', async (c) => {
  const opportunityId = c.req.param('id');
  try {
    const body = (await c.req.json().catch(() => ({}))) as { bonDeCommandeRef?: string | null };
    const ref =
      body.bonDeCommandeRef == null
        ? ''
        : typeof body.bonDeCommandeRef === 'string'
          ? body.bonDeCommandeRef.trim()
          : '';
    const bcPatch = patchToGraphqlDataLines({ bonDeCommandeRef: ref || null });
    await updateOpportunityViaGraphql(c.env, opportunityId, bcPatch.lines, bcPatch.bundle);
    return c.json({ success: true, bonDeCommandeRef: ref || null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return c.json({ message: msg }, 400);
  }
});

export { app as opportunitiesBonCommandeRoutes };
