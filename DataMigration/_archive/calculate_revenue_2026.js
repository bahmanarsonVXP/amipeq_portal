#!/usr/bin/env node
/**
 * Calculer le montant total des opportunités gagnées en 2026
 */

const { graphqlRequest } = require('./lib/core/http');

async function getWonOpportunities2026() {
  console.log('🔄 Chargement des opportunités gagnées en 2026...\n');

  const query = `
    query GetWonOpportunities2026($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter, first: 200) {
        edges {
          node {
            id
            numeroDevis
            name
            amount {
              amountMicros
              currencyCode
            }
            statutDevis
            stage
            company {
              name
            }
          }
        }
      }
    }
  `;

  const result = await graphqlRequest(query, {
    filter: {
      and: [
        { anneeDevis: { eq: 2026 } },
        { statutDevis: { eq: 'GAGNE' } }
      ]
    }
  });

  return result.opportunities?.edges.map(e => e.node) || [];
}

async function main() {
  console.log('💰 CALCUL DU CHIFFRE D\'AFFAIRES 2026\n');
  console.log('='.repeat(60) + '\n');

  const opportunities = await getWonOpportunities2026();

  console.log(`✅ ${opportunities.length} opportunités gagnées trouvées\n`);

  let totalMicros = 0;
  let countWithAmount = 0;
  let countWithoutAmount = 0;

  const details = [];

  opportunities.forEach(opp => {
    if (opp.amount && opp.amount.amountMicros) {
      const amountEuros = opp.amount.amountMicros / 1000000;
      totalMicros += opp.amount.amountMicros;
      countWithAmount++;

      details.push({
        numeroDevis: opp.numeroDevis,
        company: opp.company?.name || 'N/A',
        amount: amountEuros
      });
    } else {
      countWithoutAmount++;
    }
  });

  // Trier par montant décroissant
  details.sort((a, b) => b.amount - a.amount);

  // Afficher le top 10
  console.log('📊 TOP 10 DES OPPORTUNITÉS:\n');
  details.slice(0, 10).forEach((opp, idx) => {
    console.log(`${idx + 1}. ${opp.numeroDevis.padEnd(20)} ${opp.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
    console.log(`   ${opp.company}`);
    console.log('');
  });

  // Statistiques
  const totalEuros = totalMicros / 1000000;
  const average = countWithAmount > 0 ? totalEuros / countWithAmount : 0;

  console.log('='.repeat(60));
  console.log('💰 RÉSULTATS\n');
  console.log(`Total opportunités gagnées:        ${opportunities.length}`);
  console.log(`Avec montant:                      ${countWithAmount}`);
  console.log(`Sans montant:                      ${countWithoutAmount}`);
  console.log('');
  console.log(`💶 CHIFFRE D'AFFAIRES 2026:        ${totalEuros.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
  console.log(`📊 Montant moyen par opportunité:  ${average.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
  console.log('='.repeat(60));

  // Sauvegarder le détail
  const fs = require('fs');
  fs.writeFileSync('revenue_2026_detail.json', JSON.stringify({
    total: totalEuros,
    average: average,
    count: opportunities.length,
    countWithAmount: countWithAmount,
    details: details
  }, null, 2));

  console.log('\n✅ Détails sauvegardés dans revenue_2026_detail.json');
}

main().catch(console.error);
