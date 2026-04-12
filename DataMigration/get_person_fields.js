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
  console.log('🔍 Récupération des champs de Person...\n');

  const query = `
    query GetObjects {
      objects(paging: { first: 100 }) {
        edges {
          node {
            id
            nameSingular
            fields(paging: { first: 200 }) {
              edges {
                node {
                  name
                  label
                  type
                  isCustom
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

  console.log(`👤 Object: ${person.nameSingular} (ID: ${person.id})\n`);

  const fields = person.fields.edges.map(e => e.node);

  console.log('📝 Tous les champs (' + fields.length + ' total):');
  fields.forEach(f => {
    const marker = f.isCustom ? '🔧' : '  ';
    console.log(`${marker} ${f.name.padEnd(30)} (${f.type.padEnd(15)}) - ${f.label}`);
  });
}

main().catch(console.error);
