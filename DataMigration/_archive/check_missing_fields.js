#!/usr/bin/env node
const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

function gql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('/metadata', BASE_URL);
    const data = JSON.stringify({ query, variables });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
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
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔍 Recherche exhaustive des champs Person...\n');

  const query = `
    query GetPerson {
      objects(paging: { first: 100 }) {
        edges {
          node {
            id
            nameSingular
            fields(paging: { first: 500 }) {
              edges {
                node {
                  name
                  label
                  type
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await gql(query);

  if (result.errors) {
    console.error('❌ Erreur:', JSON.stringify(result.errors, null, 2));
    return;
  }

  const allObjects = result.data?.objects?.edges || [];
  const personEdge = allObjects.find(e => e.node.nameSingular === 'person');

  if (!personEdge) {
    console.error('❌ Object person non trouvé');
    return;
  }

  const person = personEdge.node;
  const fields = person.fields.edges.map(e => e.node);

  console.log(`👤 Person - ${fields.length} champs au total\n`);

  // Liste TOUS les champs
  console.log('📋 TOUS LES CHAMPS:');
  fields.forEach(f => {
    console.log(`   ${f.name.padEnd(40)} ${f.type.padEnd(20)} "${f.label}"`);
  });

  // Vérifier spécifiquement les champs qu'on cherche
  console.log('\n🔍 VÉRIFICATION DES CHAMPS ATTENDUS:\n');

  const checks = [
    { name: 'name', expected: 'FULL_NAME ou TEXT' },
    { name: 'firstName', expected: 'TEXT' },
    { name: 'lastName', expected: 'TEXT' },
    { name: 'phone', expected: 'PHONE ou TEXT' },
    { name: 'phones', expected: 'PHONES' },
    { name: 'email', expected: 'EMAIL ou TEXT' },
    { name: 'emails', expected: 'EMAILS' }
  ];

  checks.forEach(check => {
    const found = fields.find(f => f.name === check.name);
    if (found) {
      console.log(`   ✅ ${check.name.padEnd(20)} → ${found.type} (${found.label})`);
    } else {
      console.log(`   ❌ ${check.name.padEnd(20)} → MANQUANT (attendu: ${check.expected})`);
    }
  });
}

main().catch(console.error);
