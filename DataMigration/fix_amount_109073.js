#!/usr/bin/env node
/**
 * Corriger le montant de l'opportunité 109073-CL-26013
 * Montant actuel: 2150.50 €
 * Montant correct: 3276 €
 */

const { graphqlRequest, restRequest } = require('./lib/core/http');

const NUMERO_DEVIS = '109073-CL-26013';
const CORRECT_AMOUNT = 3276;  // euros

async function findOpportunity() {
  console.log(`🔍 Recherche de l'opportunité ${NUMERO_DEVIS}...\n`);

  const query = `
    query FindOpp($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter) {
        edges {
          node {
            id
            numeroDevis
            name
            amount {
              amountMicros
              currencyCode
            }
            createdAt
            updatedAt
            company {
              name
            }
          }
        }
      }
    }
  `;

  const result = await graphqlRequest(query, {
    filter: { numeroDevis: { eq: NUMERO_DEVIS } }
  });

  const edges = result.opportunities?.edges || [];
  if (edges.length === 0) return null;

  return edges[0].node;
}

async function updateAmount(opportunityId, newAmount) {
  console.log(`🔄 Mise à jour du montant vers ${newAmount} €...\n`);

  const result = await restRequest('PATCH', `/rest/opportunities/${opportunityId}`, {
    amount: {
      amountMicros: Math.round(newAmount * 1000000),
      currencyCode: 'EUR'
    }
  });

  return result.statusCode === 200 || result.statusCode === 201;
}

async function main() {
  console.log('🔧 CORRECTION DU MONTANT\n');
  console.log('='.repeat(60) + '\n');

  // Trouver l'opportunité
  const opp = await findOpportunity();

  if (!opp) {
    console.log(`❌ Opportunité ${NUMERO_DEVIS} non trouvée`);
    return;
  }

  console.log('✅ Opportunité trouvée:\n');
  console.log(`ID:          ${opp.id}`);
  console.log(`Nom:         ${opp.name}`);
  console.log(`Société:     ${opp.company?.name}`);
  console.log(`Créé le:     ${opp.createdAt}`);
  console.log(`Modifié le:  ${opp.updatedAt}`);
  console.log('');

  const currentAmount = opp.amount ? opp.amount.amountMicros / 1000000 : 0;
  console.log(`Montant actuel:  ${currentAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
  console.log(`Montant correct: ${CORRECT_AMOUNT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
  console.log(`Écart:           ${(CORRECT_AMOUNT - currentAmount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
  console.log('');

  // Analyse : pourquoi le montant était incorrect ?
  console.log('🔍 ANALYSE:\n');

  const createdDate = new Date(opp.createdAt);
  const updatedDate = new Date(opp.updatedAt);

  console.log(`Date de création:      ${createdDate.toLocaleString('fr-FR')}`);
  console.log(`Dernière modification: ${updatedDate.toLocaleString('fr-FR')}`);

  if (updatedDate > createdDate) {
    const diffMs = updatedDate - createdDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    console.log(`\n⚠️  L'opportunité a été modifiée ${diffDays} jour(s) après sa création`);
    console.log(`    → Possible modification manuelle du montant après l'import`);
  }

  console.log('\n💡 Hypothèses possibles:');
  console.log('   1. Fichier Excel mis à jour après l\'import initial');
  console.log('   2. Modification manuelle dans TWENTY après l\'import');
  console.log('   3. Import partiel ou incomplet de cette opportunité');
  console.log('');

  // Corriger
  const success = await updateAmount(opp.id, CORRECT_AMOUNT);

  if (success) {
    console.log('✅ MONTANT CORRIGÉ AVEC SUCCÈS\n');
    console.log(`Nouveau montant: ${CORRECT_AMOUNT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
  } else {
    console.log('❌ Échec de la correction');
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
