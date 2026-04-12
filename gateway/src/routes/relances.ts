import { Hono } from 'hono';
import { queryTwenty } from '../lib/twenty';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  const query = `
    query GetRelances {
      opportunities(
        filter: { stage: { eq: "EN_ATTENTE" }, dateRelance: { lte: { date: "${new Date().toISOString().slice(0, 10)}" } } }
        orderBy: { dateRelance: AscNullsLast }
        first: 100
      ) {
        edges {
          node {
            id name closeDate
            company { id name }
            amount { amountMicros currencyCode }
          }
        }
      }
    }
  `;
  const data = await queryTwenty(c.env, query);
  return c.json(data);
});

app.post('/:id/postpone', async (c) => {
  const { date } = await c.req.json<{ date: string }>();
  const mutation = `
    mutation PostponeRelance($id: ID!, $date: Date!) {
      updateOpportunity(id: $id, data: { dateRelance: $date }) { id }
    }
  `;
  const data = await queryTwenty(c.env, mutation, { id: c.req.param('id'), date });
  return c.json(data);
});

export { app as relancesRoutes };
