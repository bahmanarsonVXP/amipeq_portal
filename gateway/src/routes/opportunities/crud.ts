import { Hono } from 'hono';
import { queryTwenty } from '../../lib/twenty';
import { GET_OPPORTUNITIES } from '../../lib/queries';
import { mapOpportunityRow } from '../../lib/mapOpportunityRow';
import { OPPORTUNITY_STAGES, stageToStatutDevis } from '../../lib/opportunityStages';
import { createOpportunityViaGraphql } from '../../lib/opportunities/create';
import { deleteOpportunityViaGraphql } from '../../lib/opportunities/delete';
import { createOpportunityNote } from '../../lib/opportunities/notes';
import type { Env } from '../../index';
import type { OppNode } from './_shared';

const app = new Hono<{ Bindings: Env }>();

/** Création via GraphQL d'abord, puis fallback REST si besoin. */
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
    stage: body.stage?.trim() || OPPORTUNITY_STAGES.NEW,
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
  else payload.statutDevis = stageToStatutDevis(String(payload.stage));
  if (body.prestation?.length) payload.prestation = body.prestation;
  if (body.pointOfContactId?.trim()) payload.pointOfContactId = body.pointOfContactId.trim();
  if (body.anneeDevis != null && !Number.isNaN(Number(body.anneeDevis))) {
    payload.anneeDevis = Number(body.anneeDevis);
  }

  try {
    const id = await createOpportunityViaGraphql(c.env, {
      companyId,
      name,
      numeroDevis: typeof payload.numeroDevis === 'string' ? payload.numeroDevis : undefined,
      amountEur,
      stage: typeof payload.stage === 'string' ? payload.stage : undefined,
      dateDevis: typeof payload.dateDevis === 'string' ? payload.dateDevis : undefined,
      statutDevis: typeof payload.statutDevis === 'string' ? payload.statutDevis : undefined,
      prestation: Array.isArray(payload.prestation)
        ? payload.prestation.filter((value): value is string => typeof value === 'string')
        : undefined,
      pointOfContactId:
        typeof payload.pointOfContactId === 'string' ? payload.pointOfContactId : undefined,
      anneeDevis: typeof payload.anneeDevis === 'number' ? payload.anneeDevis : undefined,
    });

    if (!id) {
      return c.json({ message: "La création GraphQL n'a retourné aucun identifiant." }, 502);
    }

    return c.json({ id, success: true, mode: 'graphql' }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Création opportunité impossible via GraphQL';
    return c.json({ message }, 400);
  }
});

app.get('/', async (c) => {
  const status = c.req.query('status');
  const search = (c.req.query('search') ?? '').trim();
  const extended = c.req.query('extended') === '1';
  const rawLimit = Number.parseInt(c.req.query('limit') ?? '', 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(rawLimit, 5000))
    : extended && search
      ? 2000
      : 300;
  const filter = status ? { stage: { eq: status } } : undefined;
  const data = await queryTwenty<{
    opportunities: { edges: { node: OppNode }[] };
  }>(c.env, GET_OPPORTUNITIES, { filter, first: limit });

  let opportunities = data.opportunities.edges.map(({ node: n }) =>
    mapOpportunityRow(n, n.company),
  );

  if (extended && search) {
    const q = search.toLowerCase();
    opportunities = opportunities.filter((o) => {
      return (
        o.id.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q) ||
        (o.companyName ?? '').toLowerCase().includes(q) ||
        (o.companyCity ?? '').toLowerCase().includes(q) ||
        (o.numeroDevis ?? '').toLowerCase().includes(q)
      );
    });
  }

  return c.json({ opportunities });
});

app.post('/:id/duplicate', async (c) => {
  const sourceId = c.req.param('id');
  if (!sourceId) return c.json({ message: 'ID requis' }, 400);

  const sourceQuery = `
    query DuplicateOpportunitySource($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter, first: 1) {
        edges {
          node {
            id
            name
            numeroDevis
            prestation
            company { id }
            pointOfContact { id }
          }
        }
      }
    }
  `;

  try {
    const data = await queryTwenty<{
      opportunities?: {
        edges?: {
          node?: {
            id: string;
            name: string;
            numeroDevis?: string | null;
            prestation?: string[] | null;
            company?: { id: string } | null;
            pointOfContact?: { id: string } | null;
          };
        }[];
      };
    }>(c.env, sourceQuery, { filter: { id: { eq: sourceId } } });

    const source = data.opportunities?.edges?.[0]?.node;
    if (!source?.id) return c.json({ message: 'Opportunité introuvable' }, 404);

    const companyId = source.company?.id?.trim();
    if (!companyId) {
      return c.json({ message: 'Impossible de dupliquer : client manquant sur l’opportunité source.' }, 400);
    }

    const sourceLabel = source.numeroDevis?.trim() || source.name?.trim() || source.id.slice(0, 8);
    const newName = source.name?.trim() || `Opportunité ${sourceLabel}`;

    const newId = await createOpportunityViaGraphql(c.env, {
      companyId,
      name: newName,
      stage: OPPORTUNITY_STAGES.NEW,
      prestation: (source.prestation ?? []).filter((p): p is string => typeof p === 'string'),
      pointOfContactId: source.pointOfContact?.id ?? null,
    });

    if (!newId) {
      return c.json({ message: "La duplication n'a retourné aucun identifiant." }, 502);
    }

    await createOpportunityNote(c.env, newId, 'Duplication', `Créée à partir de ${sourceLabel}`);

    return c.json({ id: newId, success: true, sourceId: source.id }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Duplication impossible';
    return c.json({ message }, 400);
  }
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ message: 'ID requis' }, 400);
  try {
    const deleted = await deleteOpportunityViaGraphql(c.env, id);
    if (!deleted) {
      return c.json(
        {
          message:
            "Suppression impossible: l'opportunité n'a pas été supprimée via GraphQL.",
        },
        500,
      );
    }
    return c.json({ id, success: true, mode: 'graphql' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur GraphQL inconnue';
    return c.json(
      {
        message: `Suppression impossible via GraphQL: ${message}`,
      },
      500,
    );
  }
});

export { app as opportunitiesCrudRoutes };
