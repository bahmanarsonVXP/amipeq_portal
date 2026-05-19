#!/usr/bin/env node
const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

function graphql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('/graphql', BASE_URL);
    const payload = JSON.stringify({ query, variables });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function getAllOpportunities() {
  let allOpportunities = [];
  let hasMore = true;
  let cursor = null;

  console.log('🔍 Récupération de toutes les opportunities...\n');

  while (hasMore) {
    const query = `
      query GetOpportunities($after: String) {
        opportunities(first: 100, after: $after) {
          edges {
            cursor
            node {
              id
              numeroDevis
              name
              createdAt
              dateDevis
              anneeDevis
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const result = await graphql(query, { after: cursor });
    const edges = result.data.opportunities.edges;

    allOpportunities = allOpportunities.concat(edges.map(e => e.node));

    hasMore = result.data.opportunities.pageInfo.hasNextPage;
    cursor = result.data.opportunities.pageInfo.endCursor;

    process.stdout.write(`\r   Chargées: ${allOpportunities.length}`);
  }

  console.log('\n');
  return allOpportunities;
}

async function main() {
  console.log('🔎 VÉRIFICATION DES DATES INCORRECTES\n');
  console.log('='.repeat(80));

  const opportunities = await getAllOpportunities();
  
  console.log(`📊 Total: ${opportunities.length} opportunities\n`);

  // Filtrer les opportunities avec des dates avant 2020
  const incorrectDates = opportunities.filter(opp => {
    if (!opp.createdAt) return false;
    const year = new Date(opp.createdAt).getFullYear();
    return year < 2020;
  });

  if (incorrectDates.length === 0) {
    console.log('✅ Aucune date incorrecte trouvée!');
    return;
  }

  console.log(`❌ ${incorrectDates.length} opportunities avec dates incorrectes:\n`);

  // Grouper par année
  const byYear = {};
  incorrectDates.forEach(opp => {
    const year = new Date(opp.createdAt).getFullYear();
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(opp);
  });

  console.log('📅 Répartition par année:\n');
  Object.keys(byYear).sort().forEach(year => {
    console.log(`   ${year}: ${byYear[year].length} opportunities`);
  });

  console.log('\n📋 Détail des 20 premières:\n');
  incorrectDates.slice(0, 20).forEach((opp, index) => {
    const createdYear = new Date(opp.createdAt).getFullYear();
    console.log(`${index + 1}. ${opp.numeroDevis || opp.name}`);
    console.log(`   ID: ${opp.id}`);
    console.log(`   Date création: ${opp.createdAt} (année: ${createdYear})`);
    console.log(`   Date devis: ${opp.dateDevis || 'N/A'}`);
    console.log(`   Année devis: ${opp.anneeDevis || 'N/A'}`);
    console.log('');
  });

  if (incorrectDates.length > 20) {
    console.log(`... et ${incorrectDates.length - 20} autres\n`);
  }

  console.log('='.repeat(80));
  console.log(`\n💡 Total à corriger: ${incorrectDates.length} opportunities\n`);
}

main().catch(console.error);
