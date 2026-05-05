import { Hono } from 'hono';
import { queryTwenty } from '../lib/twenty';
import { twentyRestPost } from '../lib/twentyRest';
import { GET_OPPORTUNITIES } from '../lib/queries';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

type OppNode = {
  id: string;
  name: string;
  stage: string;
  amount: { amountMicros: string | number; currencyCode: string } | null;
  prestation: string[] | null;
  company: { id: string; name: string; address?: { addressPostcode?: string; addressCity?: string; addressStreet1?: string } | null } | null;
  closeDate: string | null;
};

function extractCreatedOpportunityId(json: Record<string, unknown>): string | undefined {
  const a = json.data as Record<string, unknown> | undefined;
  if (!a) return undefined;
  const b = a.data as Record<string, unknown> | undefined;
  const nestedCreate = b?.createOpportunity as { id?: string } | undefined;
  const flatCreate = a.createOpportunity as { id?: string } | undefined;
  return nestedCreate?.id ?? flatCreate?.id ?? (a as { id?: string }).id;
}

/** Création via API REST Twenty (aligné sur DataMigration / rest/opportunities) */
app.post('/', async (c) => {
  const body = await c.req.json<{
    companyId?: string;
    name?: string;
    numeroDevis?: string;
    amountEur?: number | null;
    stage?: string;
    dateDevis?: string | null;
    statutDevis?: string;
    prestation?: string[];
    pointOfContactId?: string | null;
    anneeDevis?: number | null;
  }>();

  const companyId = body.companyId?.trim();
  const name = body.name?.trim();
  if (!companyId || !name) {
    return c.json({ message: 'Champs requis : companyId, name' }, 400);
  }

  const amountEur = body.amountEur;
  const payload: Record<string, unknown> = {
    name,
    companyId,
    stage: body.stage?.trim() || 'DEVIS_ENVOYE',
  };

  if (amountEur != null && !Number.isNaN(Number(amountEur))) {
    const n = Number(amountEur);
    payload.amount = {
      amountMicros: Math.round(n * 1_000_000),
      currencyCode: 'EUR',
    };
  }

  if (body.numeroDevis?.trim()) payload.numeroDevis = body.numeroDevis.trim();
  if (body.dateDevis?.trim()) payload.dateDevis = body.dateDevis.trim();
  if (body.statutDevis?.trim()) payload.statutDevis = body.statutDevis.trim();
  if (body.prestation?.length) payload.prestation = body.prestation;
  if (body.pointOfContactId?.trim()) payload.pointOfContactId = body.pointOfContactId.trim();
  if (body.anneeDevis != null && !Number.isNaN(Number(body.anneeDevis))) {
    payload.anneeDevis = Number(body.anneeDevis);
  }

  const { status, json } = await twentyRestPost(c.env, '/rest/opportunities', payload);

  if (status < 200 || status >= 300) {
    const msg =
      (json.message as string) ||
      (json.error as string) ||
      JSON.stringify(json).slice(0, 200);
    return c.json({ message: msg || 'Erreur Twenty CRM' }, status as 400);
  }

  const id = extractCreatedOpportunityId(json);
  return c.json({ id, success: true }, 201);
});

app.get('/', async (c) => {
  const status = c.req.query('status');
  const filter = status ? { stage: { eq: status } } : undefined;
  const data = await queryTwenty<{
    opportunities: { edges: { node: OppNode }[] };
  }>(c.env, GET_OPPORTUNITIES, { filter, first: 200 });

  const opportunities = data.opportunities.edges.map(({ node: n }) => {
    const micros = n.amount?.amountMicros;
    const amountMicros =
      typeof micros === 'string' ? parseInt(micros, 10) : typeof micros === 'number' ? micros : 0;
    return {
      id: n.id,
      name: n.name,
      stage: n.stage,
      amountEur: Number.isFinite(amountMicros) ? amountMicros / 1_000_000 : null,
      currencyCode: n.amount?.currencyCode ?? 'EUR',
      prestation: n.prestation ?? [],
      companyId: n.company?.id ?? null,
      companyName: n.company?.name ?? null,
      companyPostcode: n.company?.address?.addressPostcode ?? null,
      companyCity: n.company?.address?.addressCity ?? null,
      companyStreet: n.company?.address?.addressStreet1 ?? null,
      closeDate: n.closeDate,
    };
  });

  return c.json({ opportunities });
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
