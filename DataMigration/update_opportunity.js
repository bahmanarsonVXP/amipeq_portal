#!/usr/bin/env node
/**
 * Mettre à jour une opportunité par son numéro de devis
 *
 * Usage:
 *   node update_opportunity.js "109083-CL-26027" --stage PERDU --statut PERDU
 *   node update_opportunity.js "105081-CL-23343" --date "2023-08-30"
 */

const { graphqlRequest, restRequest } = require('./lib/core/http');

const args = process.argv.slice(2);
const numeroDevis = args[0];

if (!numeroDevis) {
  console.log('❌ Usage: node update_opportunity.js <numeroDevis> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --stage <GAGNE|PERDU|DEVIS_ENVOYE>');
  console.log('  --statut <GAGNE|PERDU|EN_ATTENTE>');
  console.log('  --date <YYYY-MM-DD>');
  console.log('');
  console.log('Exemples:');
  console.log('  node update_opportunity.js "109083-CL-26027" --stage PERDU --statut PERDU');
  console.log('  node update_opportunity.js "105081-CL-23343" --date "2023-08-30"');
  process.exit(1);
}

// Parser les arguments
const updates = {};
for (let i = 1; i < args.length; i += 2) {
  const flag = args[i];
  const value = args[i + 1];

  if (flag === '--stage') updates.stage = value;
  if (flag === '--statut') updates.statutDevis = value;
  if (flag === '--date') {
    updates.dateDevis = `${value}T00:00:00.000Z`;
    updates.createdAt = `${value}T00:00:00.000Z`;
  }
}

console.log('🔍 Recherche de l\'opportunité:', numeroDevis);
console.log('📝 Mises à jour:', updates);
console.log('');

async function main() {
  try {
    // Étape 1: Trouver l'opportunité via GraphQL
    const findQuery = `
      query FindOpportunity {
        opportunityCollection(filter: { numeroDevis: { eq: "${numeroDevis}" } }) {
          edges {
            node {
              id
              name
              numeroDevis
              stage
              statutDevis
              dateDevis
              createdAt
            }
          }
        }
      }
    `;

    let result;
    try {
      result = await graphqlRequest(findQuery);
    } catch (error) {
      // GraphQL peut ne pas fonctionner, essayons REST
      console.log('⚠️  GraphQL non disponible, tentative via recherche REST...');

      // Méthode alternative: charger toutes les opportunités et filtrer
      // (pas optimal mais fonctionne)
      const allOpps = await restRequest('GET', '/rest/opportunities?limit=2000');

      if (allOpps.statusCode === 200 && allOpps.data.data) {
        const opportunities = Array.isArray(allOpps.data.data) ? allOpps.data.data : [allOpps.data.data];
        const found = opportunities.find(o => o.numeroDevis === numeroDevis);

        if (found) {
          result = {
            opportunityCollection: {
              edges: [{ node: found }]
            }
          };
        }
      }
    }

    if (!result || !result.opportunityCollection || result.opportunityCollection.edges.length === 0) {
      console.log('❌ Opportunité non trouvée');
      process.exit(1);
    }

    const opportunity = result.opportunityCollection.edges[0].node;
    console.log('✅ Opportunité trouvée:');
    console.log('   ID:', opportunity.id);
    console.log('   Nom:', opportunity.name);
    console.log('   Stage actuel:', opportunity.stage);
    console.log('   Statut actuel:', opportunity.statutDevis);
    console.log('   Date devis:', opportunity.dateDevis);
    console.log('');

    // Étape 2: Mettre à jour via REST
    console.log('📝 Mise à jour...');

    const updateResult = await restRequest('PATCH', `/rest/opportunities/${opportunity.id}`, updates);

    if (updateResult.statusCode === 200 || updateResult.statusCode === 201) {
      const updated = updateResult.data.data?.updateOpportunity || updateResult.data.data;
      console.log('✅ Mise à jour réussie!');
      console.log('');
      console.log('Nouvelles valeurs:');
      console.log('   Stage:', updated.stage);
      console.log('   Statut:', updated.statutDevis);
      console.log('   Date devis:', updated.dateDevis);
      console.log('   Date création:', updated.createdAt);
    } else {
      console.log('❌ Erreur lors de la mise à jour');
      console.log(updateResult.data);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();
