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
          const parsed = JSON.parse(body);
          if (parsed.errors) {
            reject(new Error(JSON.stringify(parsed.errors, null, 2)));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body.substring(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAllOpportunities() {
  let allOpportunities = [];
  let hasMore = true;
  let cursor = null;

  while (hasMore) {
    const query = `
      query GetOpportunities($after: String) {
        opportunities(first: 100, after: $after) {
          edges {
            cursor
            node {
              id
              name
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
    const edges = result.opportunities.edges;

    allOpportunities = allOpportunities.concat(edges.map(e => e.node));

    hasMore = result.opportunities.pageInfo.hasNextPage;
    cursor = result.opportunities.pageInfo.endCursor;
  }

  return allOpportunities;
}

async function deleteOpportunity(id) {
  const mutation = `
    mutation DeleteOpportunity($filter: OpportunityFilterInput!) {
      deleteOpportunities(filter: $filter) {
        id
      }
    }
  `;

  await graphql(mutation, { filter: { id: { eq: id } } });
}

async function main() {
  console.log('🗑️  SUPPRESSION DE TOUTES LES OPPORTUNITIES\n');
  console.log('=' .repeat(80));

  console.log('\n⏳ Récupération de toutes les opportunities...\n');

  const opportunities = await getAllOpportunities();

  console.log(`📊 ${opportunities.length} opportunities trouvées\n`);

  if (opportunities.length === 0) {
    console.log('✅ Aucune opportunity à supprimer');
    return;
  }

  console.log('🗑️  Suppression en cours...\n');

  let deleted = 0;
  for (const opp of opportunities) {
    try {
      await deleteOpportunity(opp.id);
      deleted++;
      if (deleted % 50 === 0) {
        console.log(`  Progression: ${deleted}/${opportunities.length}`);
      }
      await sleep(100); // Small delay to avoid rate limiting
    } catch (error) {
      console.error(`  ❌ Erreur suppression ${opp.name}:`, error.message);
    }
  }

  console.log(`\n✅ ${deleted}/${opportunities.length} opportunities supprimées\n`);
  console.log('=' .repeat(80));
}

main().catch(console.error);
