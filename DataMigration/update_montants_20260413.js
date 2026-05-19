#!/usr/bin/env node
/**
 * Étape 2 — Mise à jour des montants (20260402 → 20260413)
 * 9 devis avaient amount=0 et ont maintenant une valeur réelle
 */
const { graphqlRequest, restRequest } = require('./lib/core/http');

const UPDATES = [
  { numeroDevis: '107830-CL-26182', client: 'ENSEMBLE SCOLAIRE SAINTE ANNE',      offre1: 960,  offre2: null },
  { numeroDevis: '109192-CL-26184', client: 'COLLEGE SAINT HILAIRE - ALLAIRE',     offre1: 1728, offre2: null },
  { numeroDevis: '109193-CL-26185', client: 'COLLEGE NOTRE DAME DE LA CLARTE',     offre1: 680,  offre2: null },
  { numeroDevis: '109194-CL-26186', client: 'COLLEGE SAINTE EMILIE - CANDELAIR',   offre1: 1440, offre2: null },
  { numeroDevis: '109195-CL-26187', client: 'COLLEGE SAINT JOSEPH - PLEINE-FOUGERES', offre1: 1224, offre2: null },
  { numeroDevis: '109196-CL-26188', client: 'COLLEGE SAINT JOSEPH - HERIC',        offre1: 1728, offre2: null },
  { numeroDevis: '109197-CL-26189', client: 'COLLEGE SAINT JULIEN - MALESHERBES',  offre1: 2016, offre2: null },
  { numeroDevis: '109198-CL-26190', client: 'COLLEGE SAINT GILBERT - MONTLUCON',   offre1: 1440, offre2: null },
  { numeroDevis: '109199-CL-26191', client: 'COLLEGE NOTRE DAME - ROMORANTIN',     offre1: 680,  offre2: null },
];

function calcMontants(offre1, offre2) {
  const o1 = offre1 != null ? Number(offre1) : null;
  const o2 = offre2 != null ? Number(offre2) : null;
  const principal = o2 || o1;
  const amount = principal != null ? {
    amountMicros: Math.round(principal * 1_000_000),
    currencyCode: 'EUR'
  } : null;
  let tauxRemise = null;
  let montantRemise = null;
  if (o1 && o2 && o1 > 0 && o2 > 0 && o2 < o1) {
    tauxRemise = Math.round((1 - o2 / o1) * 100);
    montantRemise = { amountMicros: Math.round((o1 - o2) * 1_000_000), currencyCode: 'EUR' };
  }
  return { amount, tauxRemise, montantRemise };
}

async function findOpp(numeroDevis) {
  const query = `
    query FindOpp($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter) {
        edges { node { id name amount { amountMicros currencyCode } } }
      }
    }
  `;
  const result = await graphqlRequest(query, { filter: { numeroDevis: { eq: numeroDevis } } });
  const edges = result.opportunities?.edges || [];
  return edges[0]?.node || null;
}

async function main() {
  console.log('=== ÉTAPE 2 : MISE À JOUR MONTANTS ===\n');
  const stats = { updated: 0, notFound: 0, error: 0 };

  for (const upd of UPDATES) {
    const { amount, tauxRemise, montantRemise } = calcMontants(upd.offre1, upd.offre2);
    const mt = amount ? amount.amountMicros / 1e6 : 0;
    process.stdout.write(`  ${upd.numeroDevis} | ${upd.client.substring(0, 38).padEnd(38)} | ${mt}€ ... `);

    try {
      const opp = await findOpp(upd.numeroDevis);
      if (!opp) {
        console.log('NOT FOUND');
        stats.notFound++;
        continue;
      }
      const payload = { amount };
      if (tauxRemise !== null) { payload.tauxRemise = tauxRemise; payload.montantRemise = montantRemise; }
      const res = await restRequest('PATCH', `/rest/opportunities/${opp.id}`, payload);
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('OK');
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
  console.log(`  Non trouvés : ${stats.notFound}`);
  console.log(`  Erreurs     : ${stats.error}`);
}

main().catch(console.error);
