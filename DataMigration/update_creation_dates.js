#!/usr/bin/env node
/**
 * Mettre à jour la date de création de 2 opportunités spécifiques
 */

const { restRequest, graphqlRequest } = require('./lib/core/http');

const TARGET_OPPORTUNITIES = [
  '108802-CL-24423',
  '108802-CL-24424'
];

const NEW_DATE = '2024-12-30T00:00:00.000Z';  // 30/12/2024

async function findOpportunityId(numeroDevis) {
  const query = `
    query FindOpportunity($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter) {
        edges {
          node {
            id
            numeroDevis
            createdAt
          }
        }
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

async function updateCreatedAt(opportunityId, newDate) {
  const result = await restRequest('PATCH', `/rest/opportunities/${opportunityId}`, {
    createdAt: newDate
  });

  return result.statusCode === 200 || result.statusCode === 201;
}

async function main() {
  console.log('🔄 Mise à jour des dates de création...\n');
  console.log(`Nouvelle date: ${NEW_DATE}\n`);

  for (const numeroDevis of TARGET_OPPORTUNITIES) {
    console.log(`📋 Traitement ${numeroDevis}...`);

    // Trouver l'opportunité
    const opp = await findOpportunityId(numeroDevis);

    if (!opp) {
      console.log(`  ❌ Non trouvée\n`);
      continue;
    }

    console.log(`  ✓ Trouvée: ${opp.id}`);
    console.log(`  Date actuelle: ${opp.createdAt}`);

    // Mettre à jour
    const success = await updateCreatedAt(opp.id, NEW_DATE);

    if (success) {
      console.log(`  ✅ Date mise à jour avec succès\n`);
    } else {
      console.log(`  ❌ Échec de la mise à jour\n`);
    }
  }

  console.log('✅ Terminé');
}

main().catch(console.error);
