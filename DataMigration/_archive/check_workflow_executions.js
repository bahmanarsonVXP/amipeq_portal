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

async function main() {
  const query = `
    query {
      workflowRuns(orderBy: [{ createdAt: DescNullsLast }], first: 10) {
        edges {
          node {
            id
            name
            status
            startedAt
            endedAt
            output
            workflowVersion {
              id
              name
              workflow {
                name
              }
            }
          }
        }
      }
    }
  `;

  console.log('🔄 DERNIÈRES EXÉCUTIONS DU WORKFLOW\n');
  console.log('=' .repeat(80));

  try {
    const result = await graphql(query);
    const runs = result.workflowRuns.edges;

    runs.forEach((edge, idx) => {
      const run = edge.node;
      console.log(`\n${idx + 1}. ${run.workflowVersion?.workflow?.name || run.workflowVersion?.name || 'N/A'}`);
      console.log(`   ID: ${run.id}`);
      console.log(`   Status: ${run.status}`);
      console.log(`   Démarré: ${run.startedAt}`);
      console.log(`   Terminé: ${run.endedAt || 'N/A'}`);
      console.log(`   Output: ${run.output || 'null'}`);

      if (run.status === 'FAILED') {
        console.log(`   ⚠️  ÉCHEC - Vérifier les logs`);
      }
    });

    console.log('\n' + '=' .repeat(80));

    // Compter les statuts
    const counts = runs.reduce((acc, edge) => {
      const status = edge.node.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 Résumé des 10 dernières exécutions:');
    Object.entries(counts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

main().catch(console.error);
