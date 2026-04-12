#!/usr/bin/env node
/**
 * Liste les champs de la table Opportunity (source: Twenty Metadata API)
 * Usage: node scripts/opportunity_fields.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY;

if (!BASE_URL || !API_KEY) {
  console.error('❌ Définir TWENTY_BASE_URL et TWENTY_API_KEY dans .env');
  process.exit(1);
}

function gqlRequest(endpoint, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const data = JSON.stringify({ query, variables });
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Parse error: ' + body.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const objectsRes = await gqlRequest('/metadata', `
    query {
      objects(paging: { first: 100 }) {
        edges {
          node {
            id
            nameSingular
            namePlural
            labelSingular
            fields(paging: { first: 300 }) {
              edges {
                node {
                  id
                  name
                  label
                  type
                  isCustom
                  isNullable
                }
              }
            }
          }
        }
      }
    }
  `);

  if (objectsRes.errors) {
    console.error('❌ Erreur API:', JSON.stringify(objectsRes.errors, null, 2));
    process.exit(1);
  }

  const edges = objectsRes.data?.objects?.edges || [];
  const oppEdge = edges.find((e) => e.node.nameSingular === 'opportunity');
  if (!oppEdge) {
    console.error('❌ Objet "opportunity" non trouvé dans le schéma Twenty.');
    process.exit(1);
  }

  const opp = oppEdge.node;
  const fields = (opp.fields?.edges || []).map((e) => e.node);

  console.log('Champs de la table Opportunity (Twenty)\n');
  console.log('Objet:', opp.labelSingular || opp.nameSingular, `(${fields.length} champs)\n`);

  const standard = fields.filter((f) => !f.isCustom);
  const custom = fields.filter((f) => f.isCustom);

  if (standard.length) {
    console.log('--- Champs standard ---');
    standard.forEach((f) => {
      const nullable = f.isNullable ? '?' : '';
      console.log(`  ${f.name.padEnd(35)} ${(f.type || '').padEnd(18)} ${nullable}  ${f.label || ''}`);
    });
    console.log('');
  }
  if (custom.length) {
    console.log('--- Champs personnalisés ---');
    custom.forEach((f) => {
      const nullable = f.isNullable ? '?' : '';
      console.log(`  ${f.name.padEnd(35)} ${(f.type || '').padEnd(18)} ${nullable}  ${f.label || ''}`);
    });
  }

  console.log('\nTotal:', fields.length, 'champs');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
