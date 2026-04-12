import { Hono } from 'hono';
import { queryTwenty } from '../lib/twenty';
import { GET_COMPANIES } from '../lib/queries';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  const search = c.req.query('search');
  const filter = search ? { name: { like: `%${search}%` } } : undefined;
  const data = await queryTwenty<{
    companies: { edges: { node: { id: string; name: string } }[] };
  }>(c.env, GET_COMPANIES, { filter, first: 100 });
  const companies = data.companies.edges.map((e) => e.node);
  return c.json({ companies });
});

app.get('/:id', async (c) => {
  const query = `
    query GetCompany($id: ID!) {
      company(id: $id) {
        id name domainName { primaryLinkUrl }
        address { addressStreet1 addressCity addressPostcode }
        phone
        people { edges { node { id firstName lastName email phone jobTitle } } }
        opportunities { edges { node { id name amount { amountMicros currencyCode } stage closeDate } } }
      }
    }
  `;
  const data = await queryTwenty(c.env, query, { id: c.req.param('id') });
  return c.json(data);
});

export { app as companiesRoutes };
