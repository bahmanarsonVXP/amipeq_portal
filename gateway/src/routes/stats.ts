import { Hono } from 'hono';
import { queryTwenty } from '../lib/twenty';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

app.get('/dashboard', async (c) => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const query = `
    query DashboardStats {
      gained: opportunities(filter: { stage: { eq: "GAGNE" }, closeDate: { gte: { date: "${firstOfMonth}" } } }) {
        totalCount
        edges { node { amount { amountMicros } } }
      }
      pending: opportunities(filter: { stage: { eq: "EN_ATTENTE" } }) {
        totalCount
        edges { node { amount { amountMicros } } }
      }
      overdue: opportunities(
        filter: {
          stage: { eq: "EN_ATTENTE" }
          dateRelance: { lte: { date: "${today.toISOString().slice(0, 10)}" } }
        }
      ) { totalCount }
      activeClients: companies(filter: { statutClient: { eq: "CLIENT_ACTIF" } }) { totalCount }
    }
  `;

  const data = await queryTwenty<{
    gained: { totalCount: number; edges: { node: { amount: { amountMicros: number } } }[] };
    pending: { totalCount: number; edges: { node: { amount: { amountMicros: number } } }[] };
    overdue: { totalCount: number };
    activeClients: { totalCount: number };
  }>(c.env, query);

  const caMois = data.gained.edges.reduce((sum, e) => sum + (e.node.amount.amountMicros / 1_000_000), 0);
  const potentielDevis = data.pending.edges.reduce((sum, e) => sum + (e.node.amount.amountMicros / 1_000_000), 0);

  return c.json({
    caMois,
    caVariation: 0,
    devisEnAttente: data.pending.totalCount,
    potentielDevis,
    tauxConversion: data.gained.totalCount > 0
      ? Math.round(data.gained.totalCount / (data.gained.totalCount + data.pending.totalCount) * 100)
      : 0,
    conversionVariation: 0,
    clientsActifs: data.activeClients.totalCount,
    nouveauxClients: 0,
    relancesEnRetard: data.overdue.totalCount,
  });
});

export { app as statsRoutes };
