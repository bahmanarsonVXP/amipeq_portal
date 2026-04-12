#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
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
      __type(name: "CompanyDepartementEnum") {
        name
        kind
        enumValues {
          name
          description
        }
      }
    }
  `;

  console.log('🔍 VALEURS DE L\'ENUM "CompanyDepartementEnum"\n');
  console.log('=' .repeat(80));

  try {
    const result = await graphql(query);
    const enumType = result.__type;

    if (!enumType) {
      console.log('❌ Enum "CompanyDepartementEnum" non trouvé');
      return;
    }

    console.log(`\n📦 Enum: ${enumType.name}`);
    console.log(`   Type: ${enumType.kind}`);
    console.log(`   Nombre de valeurs: ${enumType.enumValues.length}\n`);

    console.log('📋 TOUTES LES VALEURS AUTORISÉES:\n');
    enumType.enumValues.forEach((value, idx) => {
      console.log(`   ${idx + 1}. ${value.name}`);
      if (value.description) {
        console.log(`      ${value.description}`);
      }
    });

    // Check for our test departments
    console.log('\n' + '=' .repeat(80));
    console.log('\n🔍 VÉRIFICATION DES DÉPARTEMENTS TESTÉS:\n');

    const testValues = [
      { code: 'DEPT_12_AVEYRON', status: '✅ OK' },
      { code: 'DEPT_13_BOUCHES_DU_RHONE', status: '❓ À vérifier' },
      { code: 'DEPT_48_LOZERE', status: '❓ À vérifier' }
    ];

    testValues.forEach(test => {
      const found = enumType.enumValues.find(v => v.name === test.code);
      if (found) {
        console.log(`   ✅ ${test.code} - TROUVÉ`);
      } else {
        console.log(`   ❌ ${test.code} - NON TROUVÉ`);

        // Try to find similar values
        const similar = enumType.enumValues.filter(v =>
          v.name.includes('_13_') ||
          v.name.includes('_48_') ||
          v.name.toLowerCase().includes('bouches') ||
          v.name.toLowerCase().includes('lozere')
        );

        if (similar.length > 0) {
          console.log(`      → Valeurs similaires trouvées:`);
          similar.forEach(s => console.log(`         ${s.name}`));
        }
      }
    });

    // Save all values to a file for reference
    const output = {
      enumName: enumType.name,
      count: enumType.enumValues.length,
      values: enumType.enumValues.map(v => v.name)
    };

    fs.writeFileSync('departement_enum_values.json', JSON.stringify(output, null, 2));
    console.log(`\n\n💾 Toutes les valeurs sauvegardées dans: departement_enum_values.json`);

    console.log('\n' + '=' .repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

main().catch(console.error);
