import { Hono } from 'hono';
import { queryTwenty } from '../../lib/twenty';
import { GET_OPPORTUNITIES } from '../../lib/queries';
import { mapOpportunityRow } from '../../lib/mapOpportunityRow';
import { OPPORTUNITY_STAGES } from '../../lib/opportunityStages';
import type { Env } from '../../index';
import type { OppNode } from './_shared';

const app = new Hono<{ Bindings: Env }>();

app.get('/reports/bc-manquant', async (c) => {
  const data = await queryTwenty<{
    opportunities: { edges: { node: OppNode }[] };
  }>(c.env, GET_OPPORTUNITIES, { filter: { stage: { eq: OPPORTUNITY_STAGES.WON } }, first: 500 });
  const rows = data.opportunities.edges
    .map(({ node: n }) => mapOpportunityRow(n, n.company))
    .filter((o) => o.bcMissing);
  return c.json({
    opportunities: rows.map((o) => ({
      id: o.id,
      name: o.name,
      stage: o.stage,
      companyId: o.companyId,
      companyName: o.companyName,
      numeroDevis: o.numeroDevis,
      bonDeCommandeRef: o.bonDeCommandeRef,
      bcMissing: o.bcMissing,
    })),
  });
});

export { app as opportunitiesReportsRoutes };
