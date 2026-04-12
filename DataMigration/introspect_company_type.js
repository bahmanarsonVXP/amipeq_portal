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
      __type(name: "Company") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  `;

  console.log('🔍 INTROSPECTION DU TYPE "Company"\n');
  console.log('=' .repeat(80));

  try {
    const result = await graphql(query);
    const companyType = result.__type;

    if (!companyType) {
      console.log('❌ Type "Company" non trouvé');
      return;
    }

    console.log(`\n📦 Type: ${companyType.name}`);
    console.log(`   Nombre de champs: ${companyType.fields.length}\n`);

    // Search for department fields
    const deptFields = companyType.fields.filter(f =>
      f.name.toLowerCase().includes('depart')
    );

    if (deptFields.length > 0) {
      console.log('✅ CHAMPS DÉPARTEMENT TROUVÉS:\n');
      deptFields.forEach(field => {
        console.log(`   ${field.name}`);
        console.log(`      Type: ${field.type.kind} ${field.type.name || field.type.ofType?.name || ''}`);
      });
    } else {
      console.log('❌ Aucun champ département trouvé dans le type Company');
    }

    // Show all fields containing "address", "numero", or custom fields
    console.log('\n\n📋 TOUS LES CHAMPS (filtré pour debug):\n');
    companyType.fields
      .filter(f => {
        const name = f.name.toLowerCase();
        return name.includes('depart') ||
               name.includes('address') ||
               name.includes('numero') ||
               name.includes('nombreeleves') ||
               name.includes('domain');
      })
      .forEach(field => {
        console.log(`   • ${field.name} (${field.type.kind}: ${field.type.name || field.type.ofType?.name})`);
      });

    console.log('\n' + '=' .repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

main().catch(console.error);
