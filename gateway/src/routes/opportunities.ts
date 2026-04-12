import { Hono } from 'hono';
import { queryTwenty } from '../lib/twenty';
import { GET_OPPORTUNITIES } from '../lib/queries';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  const status = c.req.query('status');
  const filter = status ? { stage: { eq: status } } : undefined;
  const data = await queryTwenty(c.env, GET_OPPORTUNITIES, { filter, first: 200 });
  return c.json(data);
});

app.post('/:id/status', async (c) => {
  const { status } = await c.req.json<{ status: string }>();
  const mutation = `
    mutation UpdateOpportunity($id: ID!, $stage: String!) {
      updateOpportunity(id: $id, data: { stage: $stage }) { id stage }
    }
  `;
  const data = await queryTwenty(c.env, mutation, { id: c.req.param('id'), stage: status });
  return c.json(data);
});

export { app as opportunitiesRoutes };
