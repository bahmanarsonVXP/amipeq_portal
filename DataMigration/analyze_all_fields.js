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
  console.log('🔍 Analyse complète des champs Company et Person\n');

  const query = `
    query GetAllFields {
      objects(paging: { first: 100 }) {
        edges {
          node {
            id
            nameSingular
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
                  description
                  defaultValue
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

  // Analyser Company
  const companyEdge = allObjects.find(e => e.node.nameSingular === 'company');
  if (companyEdge) {
    const company = companyEdge.node;
    const fields = company.fields.edges.map(e => e.node);

    console.log('═══════════════════════════════════════════════════════');
    console.log(`📦 COMPANY (${company.labelSingular}) - ${fields.length} champs`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Grouper par catégorie
    const standardFields = fields.filter(f => !f.isCustom);
    const customFields = fields.filter(f => f.isCustom);

    console.log('📌 CHAMPS STANDARD (' + standardFields.length + '):');
    standardFields.forEach(f => {
      const nullable = f.isNullable ? '?' : '!';
      const desc = f.description ? ` // ${f.description}` : '';
      console.log(`   ${f.name.padEnd(35)} ${f.type.padEnd(15)} ${nullable}  ${desc}`);
    });

    console.log('\n🔧 CHAMPS CUSTOM (' + customFields.length + '):');
    customFields.forEach(f => {
      const nullable = f.isNullable ? '?' : '!';
      const desc = f.description ? ` // ${f.description}` : '';
      console.log(`   ${f.name.padEnd(35)} ${f.type.padEnd(15)} ${nullable}  ${desc}`);
    });

    // Champs spécifiques à rechercher
    console.log('\n🔎 CHAMPS CLÉS:');

    const addressFields = fields.filter(f =>
      f.name.toLowerCase().includes('address') ||
      f.name.toLowerCase().includes('adresse')
    );
    if (addressFields.length > 0) {
      console.log('\n   📍 Adresse:');
      addressFields.forEach(f => {
        console.log(`      - ${f.name} (${f.type})`);
      });
    }

    const phoneFields = fields.filter(f =>
      f.name.toLowerCase().includes('phone') ||
      f.name.toLowerCase().includes('tel')
    );
    if (phoneFields.length > 0) {
      console.log('\n   📞 Téléphone:');
      phoneFields.forEach(f => {
        console.log(`      - ${f.name} (${f.type})`);
      });
    }

    const emailFields = fields.filter(f =>
      f.name.toLowerCase().includes('email') ||
      f.name.toLowerCase().includes('mail')
    );
    if (emailFields.length > 0) {
      console.log('\n   📧 Email:');
      emailFields.forEach(f => {
        console.log(`      - ${f.name} (${f.type})`);
      });
    }
  }

  // Analyser Person
  const personEdge = allObjects.find(e => e.node.nameSingular === 'person');
  if (personEdge) {
    const person = personEdge.node;
    const fields = person.fields.edges.map(e => e.node);

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log(`👤 PERSON (${person.labelSingular}) - ${fields.length} champs`);
    console.log('═══════════════════════════════════════════════════════\n');

    const standardFields = fields.filter(f => !f.isCustom);
    const customFields = fields.filter(f => f.isCustom);

    console.log('📌 CHAMPS STANDARD (' + standardFields.length + '):');
    standardFields.forEach(f => {
      const nullable = f.isNullable ? '?' : '!';
      const desc = f.description ? ` // ${f.description}` : '';
      console.log(`   ${f.name.padEnd(35)} ${f.type.padEnd(15)} ${nullable}  ${desc}`);
    });

    console.log('\n🔧 CHAMPS CUSTOM (' + customFields.length + '):');
    customFields.forEach(f => {
      const nullable = f.isNullable ? '?' : '!';
      const desc = f.description ? ` // ${f.description}` : '';
      console.log(`   ${f.name.padEnd(35)} ${f.type.padEnd(15)} ${nullable}  ${desc}`);
    });

    // Champs spécifiques
    console.log('\n🔎 CHAMPS CLÉS:');

    const nameFields = fields.filter(f =>
      f.name.toLowerCase().includes('name') ||
      f.name.toLowerCase().includes('nom')
    );
    if (nameFields.length > 0) {
      console.log('\n   👤 Nom:');
      nameFields.forEach(f => {
        console.log(`      - ${f.name} (${f.type})`);
      });
    }

    const phoneFields = fields.filter(f =>
      f.name.toLowerCase().includes('phone') ||
      f.name.toLowerCase().includes('tel')
    );
    if (phoneFields.length > 0) {
      console.log('\n   📞 Téléphone:');
      phoneFields.forEach(f => {
        console.log(`      - ${f.name} (${f.type})`);
      });
    }

    const emailFields = fields.filter(f =>
      f.name.toLowerCase().includes('email') ||
      f.name.toLowerCase().includes('mail')
    );
    if (emailFields.length > 0) {
      console.log('\n   📧 Email:');
      emailFields.forEach(f => {
        console.log(`      - ${f.name} (${f.type})`);
      });
    }
  }

  // Analyser Opportunity
  const oppEdge = allObjects.find(e => e.node.nameSingular === 'opportunity');
  if (oppEdge) {
    const opp = oppEdge.node;
    const fields = opp.fields.edges.map(e => e.node);

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log(`💼 OPPORTUNITY (${opp.labelSingular}) - ${fields.length} champs`);
    console.log('═══════════════════════════════════════════════════════\n');

    const customFields = fields.filter(f => f.isCustom);

    console.log('🔧 CHAMPS CUSTOM (' + customFields.length + '):');
    customFields.forEach(f => {
      const nullable = f.isNullable ? '?' : '!';
      console.log(`   ${f.name.padEnd(35)} ${f.type.padEnd(15)} ${nullable}`);
    });
  }
}

main().catch(console.error);
