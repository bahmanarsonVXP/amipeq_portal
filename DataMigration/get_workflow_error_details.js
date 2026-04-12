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

async function getWorkflowRunDetails(runId) {
  // First try to get the full run details
  const query = `
    query GetWorkflowRun($filter: WorkflowRunFilterInput!) {
      workflowRuns(filter: $filter) {
        edges {
          node {
            id
            name
            status
            startedAt
            endedAt
            output
          }
        }
      }
    }
  `;

  try {
    const result = await graphql(query, { filter: { id: { eq: runId } } });
    return result.workflowRuns.edges[0]?.node;
  } catch (error) {
    console.error('Error getting run details:', error.message);
    return null;
  }
}

async function main() {
  // Get the failed runs IDs from the previous output
  const failedRunIds = [
    '57fb2db6-9316-4e93-af99-5e164c357f36', // CP 48000
    '8cb3a8ce-0d06-4d5a-a3fc-97851b5bd044'  // CP 13000
  ];

  console.log('🔍 DÉTAILS DES EXÉCUTIONS ÉCHOUÉES\n');
  console.log('=' .repeat(80));

  for (const runId of failedRunIds) {
    console.log(`\n📋 Exécution: ${runId}`);
    const details = await getWorkflowRunDetails(runId);
    if (details) {
      console.log(`   Status: ${details.status}`);
      console.log(`   Démarré: ${details.startedAt}`);
      console.log(`   Terminé: ${details.endedAt}`);
      console.log(`   Output: ${details.output || 'null'}`);
      console.log(`   Name: ${details.name}`);
    } else {
      console.log('   ❌ Impossible de récupérer les détails');
    }
  }

  console.log('\n' + '=' .repeat(80));
  console.log('\n💡 Les outputs sont "null" - TWENTY ne stocke pas les erreurs dans les runs.');
  console.log('   Il faut vérifier directement dans l\'interface TWENTY ou les logs serveur.');
  console.log('\n🔧 HYPOTHÈSE: Certaines valeurs de département ne sont peut-être pas');
  console.log('   configurées dans le champ SELECT "Département" de TWENTY.');
  console.log('\n   Départements testés:');
  console.log('   ✅ 12 - Aveyron (DEPT_12_AVEYRON) - FONCTIONNE');
  console.log('   ❌ 13 - Bouches-du-Rhône (DEPT_13_BOUCHES_DU_RHONE) - ÉCHOUE');
  console.log('   ❌ 48 - Lozère (DEPT_48_LOZERE) - ÉCHOUE');
}

main().catch(console.error);
