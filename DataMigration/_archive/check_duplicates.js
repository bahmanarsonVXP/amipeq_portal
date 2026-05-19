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
  console.log('🔎 VÉRIFICATION DES DOUBLONS DE NUMÉROS DE DEVIS\n');
  console.log('='.repeat(80));

  const opportunities = await getAllOpportunities();
  
  console.log(`📊 Total: ${opportunities.length} opportunities\n`);

  // Grouper par numeroDevis
  const byNumeroDevis = {};
  opportunities.forEach(opp => {
    const numero = opp.numeroDevis || opp.name || 'SANS_NUMERO';
    if (!byNumeroDevis[numero]) {
      byNumeroDevis[numero] = [];
    }
    byNumeroDevis[numero].push(opp);
  });

  // Trouver les doublons
  const duplicates = {};
  Object.keys(byNumeroDevis).forEach(numero => {
    if (byNumeroDevis[numero].length > 1) {
      duplicates[numero] = byNumeroDevis[numero];
    }
  });

  const duplicateCount = Object.keys(duplicates).length;
  const totalDuplicateOpps = Object.values(duplicates).reduce((sum, arr) => sum + arr.length, 0);

  if (duplicateCount === 0) {
    console.log('✅ Aucun doublon trouvé!\n');
    return;
  }

  console.log(`❌ ${duplicateCount} numéros de devis en doublon\n`);
  console.log(`📋 Total d'opportunities concernées: ${totalDuplicateOpps}\n`);
  console.log('='.repeat(80));
  console.log('\n📝 Détail des doublons:\n');

  const sortedDuplicates = Object.keys(duplicates).sort();
  
  sortedDuplicates.slice(0, 20).forEach((numero, index) => {
    const opps = duplicates[numero];
    console.log(`${index + 1}. Numéro devis: ${numero} (${opps.length} occurrences)`);
    opps.forEach((opp, i) => {
      console.log(`   ${i + 1}) ID: ${opp.id}`);
      console.log(`      Créé le: ${opp.createdAt}`);
    });
    console.log('');
  });

  if (duplicateCount > 20) {
    console.log(`... et ${duplicateCount - 20} autres doublons\n`);
  }

  console.log('='.repeat(80));
  console.log(`\n💡 Action requise: Supprimer et ré-importer avec déduplication\n`);
}

main().catch(console.error);
