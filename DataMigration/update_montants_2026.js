/**
 * update_montants_2026.js
 *
 * Met à jour les montants (amount, tauxRemise, montantRemise) pour les 2 devis
 * dont les valeurs ont réellement changé dans SUIVIS_CLIENTS_2026_20260402.xlsx :
 *
 *   - 109133-CL-26101 : offre1/offre2 consolidés (ancien fichier avait -1 et -2 séparés)
 *   - 109152-CL-26129 : MADEMOISELLE JULIE SERVICES — offre2 : 750 → 637.5
 */

const { graphqlRequest, restRequest } = require('./lib/core/http');

// Calcule amount, tauxRemise, montantRemise depuis offre1 et offre2
function calcMontants(offre1, offre2) {
  const o1 = offre1 != null ? Number(offre1) : null;
  const o2 = offre2 != null ? Number(offre2) : null;

  const montantPrincipal = o2 || o1;
  const amount = montantPrincipal != null ? {
    amountMicros: Math.round(montantPrincipal * 1_000_000),
    currencyCode: 'EUR'
  } : null;

  let tauxRemise = null;
  let montantRemise = null;
  if (o1 && o2 && o1 > 0 && o2 > 0 && o2 < o1) {
    tauxRemise = Math.round((1 - o2 / o1) * 100);
    montantRemise = {
      amountMicros: Math.round((o1 - o2) * 1_000_000),
      currencyCode: 'EUR'
    };
  }

  return { amount, tauxRemise, montantRemise };
}

// Les 2 devis à mettre à jour (nouvelles valeurs issues du fichier 20260402)
// 109133-CL-26101 : le fichier consolidé remplace les anciennes lignes -1 et -2
// Nouveau montant principal basé sur la ligne avec offre1=1840, offre2=1472
const UPDATES = [
  {
    numeroDevis: '109133-CL-26101',
    client: 'ENSEMBLE SCOLAIRE NOTRE DAME DES CHENES',
    offre1: 1840,
    offre2: 1472,
  },
  {
    numeroDevis: '109152-CL-26129',
    client: 'MADEMOISELLE JULIE SERVICES',
    offre1: 750,
    offre2: 637.5,
  },
];

async function findOpportunityId(numeroDevis) {
  const query = `
    query FindOpp($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter) {
        edges {
          node { id name amount { amountMicros currencyCode } }
        }
        totalCount
      }
    }
  `;
  const result = await graphqlRequest(query, {
    filter: { numeroDevis: { eq: numeroDevis } }
  });
  const edges = result.opportunities?.edges || [];
  if (edges.length === 0) return null;
  return edges[0].node;
}

async function main() {
  console.log('=== MISE À JOUR MONTANTS 2026 ===\n');

  const stats = { updated: 0, notFound: 0, error: 0 };

  for (const upd of UPDATES) {
    const { amount, tauxRemise, montantRemise } = calcMontants(upd.offre1, upd.offre2);
    process.stdout.write(`  ${upd.numeroDevis} | ${upd.client.substring(0, 35).padEnd(35)} | amount: ${amount?.amountMicros / 1e6}€ remise: ${tauxRemise}% ... `);

    try {
      const opp = await findOpportunityId(upd.numeroDevis);

      if (!opp) {
        console.log('NOT FOUND (sera créé par import-master)');
        stats.notFound++;
        continue;
      }

      const result = await restRequest('PATCH', `/rest/opportunities/${opp.id}`, {
        amount,
        tauxRemise,
        montantRemise,
      });

      if (result.statusCode === 200 || result.statusCode === 201) {
        console.log(`OK (id: ${opp.id})`);
        stats.updated++;
      } else {
        console.log(`ERROR ${result.statusCode}: ${JSON.stringify(result.data).substring(0, 150)}`);
        stats.error++;
      }
    } catch (err) {
      console.log(`EXCEPTION: ${err.message}`);
      stats.error++;
    }
  }

  console.log('\n=== RÉSUMÉ ===');
  console.log(`  Mis à jour : ${stats.updated}`);
  console.log(`  Non trouvés: ${stats.notFound}`);
  console.log(`  Erreurs    : ${stats.error}`);
}

main().catch(console.error);
