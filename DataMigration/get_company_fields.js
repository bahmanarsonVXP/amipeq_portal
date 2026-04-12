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
  console.log('🔍 Récupération des champs de Company...\n');

  const query = `
    query GetObjects {
      objects(paging: { first: 100 }) {
        edges {
          node {
            id
            nameSingular
            labelSingular
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
  const companyEdge = allObjects.find(e => e.node.nameSingular === 'company');

  if (!companyEdge) {
    console.error('❌ Object company non trouvé');
    console.log('Objects disponibles:', allObjects.map(e => e.node.nameSingular).join(', '));
    return;
  }

  const company = companyEdge.node;

  console.log(`📦 Object: ${company.nameSingular} (ID: ${company.id})\n`);
  console.log('📋 Champs disponibles:\n');

  const fields = company.fields.edges.map(e => e.node);

  // Champs liés au téléphone
  const phoneFields = fields.filter(f =>
    f.name.toLowerCase().includes('phone') ||
    f.name.toLowerCase().includes('tel') ||
    f.label.toLowerCase().includes('phone') ||
    f.label.toLowerCase().includes('tél')
  );

  console.log('📞 Champs téléphone:');
  if (phoneFields.length > 0) {
    phoneFields.forEach(f => {
      console.log(`  - ${f.name} (${f.type}) - "${f.label}" ${f.isCustom ? '[CUSTOM]' : '[STANDARD]'}`);
    });
  } else {
    console.log('  ⚠️  Aucun champ téléphone trouvé !');
  }

  // Champs liés à l'email
  const emailFields = fields.filter(f =>
    f.name.toLowerCase().includes('email') ||
    f.name.toLowerCase().includes('mail')
  );

  console.log('\n📧 Champs email:');
  if (emailFields.length > 0) {
    emailFields.forEach(f => {
      console.log(`  - ${f.name} (${f.type}) - "${f.label}" ${f.isCustom ? '[CUSTOM]' : '[STANDARD]'}`);
    });
  } else {
    console.log('  ⚠️  Aucun champ email trouvé !');
  }

  // Tous les champs
  console.log('\n📝 Tous les champs (' + fields.length + ' total):');
  fields.forEach(f => {
    const marker = f.isCustom ? '🔧' : '  ';
    console.log(`${marker} ${f.name.padEnd(30)} (${f.type.padEnd(15)}) - ${f.label}`);
  });
}

main().catch(console.error);
