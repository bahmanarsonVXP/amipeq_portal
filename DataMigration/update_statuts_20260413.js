#!/usr/bin/env node
/**
 * Étape 1 — Mise à jour des statuts (20260402 → 20260413)
 * 6 devis passent de EN_ATTENTE → GAGNE (cellule H colorée en vert 92D050)
 */
const { graphqlRequest, restRequest } = require('./lib/core/http');

const UPDATES = [
  { numeroDevis: '109135-CL-26105', client: 'ECOLE SAINTE ANNE - LA BAZOU' },
  { numeroDevis: '109169-CL-26149', client: 'ECOLE SAINT JEAN BOSCO - SENLIS' },
  { numeroDevis: '109176-CL-26158', client: 'ECOLE SAINT JOSEPH DE BONABRE' },
  { numeroDevis: '109181-CL-26166', client: 'ECOLE SAINTE BERNADETTE - AR' },
  { numeroDevis: '109189-CL-26178', client: 'COLLEGE ALBERT CAMUS' },
  { numeroDevis: '106550-CL-26180', client: 'LYCEE PROFESSIONNEL PAUL LANGEVIN' },
];

async function findOpp(numeroDevis) {
  const query = `
    query FindOpp($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter) {
        edges { node { id name stage statutDevis } }
      }
    }
  `;
  const result = await graphqlRequest(query, { filter: { numeroDevis: { eq: numeroDevis } } });
  const edges = result.opportunities?.edges || [];
  return edges[0]?.node || null;
}

async function main() {
  console.log('=== ÉTAPE 1 : MISE À JOUR STATUTS → GAGNE ===\n');
  const stats = { updated: 0, notFound: 0, alreadyOk: 0, error: 0 };

  for (const upd of UPDATES) {
    process.stdout.write(`  ${upd.numeroDevis} | ${upd.client.substring(0, 38).padEnd(38)} ... `);
    try {
      const opp = await findOpp(upd.numeroDevis);
      if (!opp) {
        console.log('NOT FOUND');
        stats.notFound++;
        continue;
      }
      if (opp.stage === 'GAGNE' && opp.statutDevis === 'GAGNE') {
        console.log('déjà GAGNE');
        stats.alreadyOk++;
        continue;
      }
      const res = await restRequest('PATCH', `/rest/opportunities/${opp.id}`, {
        stage: 'GAGNE',
        statutDevis: 'GAGNE',
      });
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log(`OK (${opp.stage} → GAGNE)`);
        stats.updated++;
      } else {
        console.log(`ERROR ${res.statusCode}: ${JSON.stringify(res.data).substring(0, 120)}`);
        stats.error++;
      }
    } catch (err) {
      console.log(`EXCEPTION: ${err.message}`);
      stats.error++;
    }
  }

  console.log('\n=== RÉSUMÉ ===');
  console.log(`  Mis à jour  : ${stats.updated}`);
  console.log(`  Déjà OK     : ${stats.alreadyOk}`);
  console.log(`  Non trouvés : ${stats.notFound}`);
  console.log(`  Erreurs     : ${stats.error}`);
}

main().catch(console.error);
