#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

function restRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🗑️  Suppression des données test...\n');

  // Lire les mappings
  const mappings = JSON.parse(fs.readFileSync('mappings.json', 'utf-8'));

  // Supprimer les opportunities
  const oppIds = Object.values(mappings.opportunities);
  console.log(`💼 Suppression de ${oppIds.length} opportunities...`);
  for (const id of oppIds) {
    if (!id) continue;
    await restRequest('DELETE', `/rest/opportunities/${id}`);
  }
  console.log('  ✅ Opportunities supprimées');

  // Supprimer les persons
  const personIds = Object.values(mappings.persons);
  console.log(`\n👤 Suppression de ${personIds.length} persons...`);
  for (const id of personIds) {
    if (!id) continue;
    await restRequest('DELETE', `/rest/people/${id}`);
  }
  console.log('  ✅ Persons supprimées');

  // Supprimer les companies
  const companyIds = Object.values(mappings.companies);
  console.log(`\n📦 Suppression de ${companyIds.length} companies...`);
  for (const id of companyIds) {
    if (!id) continue;
    await restRequest('DELETE', `/rest/companies/${id}`);
  }
  console.log('  ✅ Companies supprimées');

  // Aussi supprimer les 2 companies de test manuelles
  console.log(`\n🧪 Suppression des companies de test manuelles...`);
  const testIds = [
    'a17e9585-949f-4b10-9ecc-3450aa120c8c',  // TEST COMPANY - À SUPPRIMER
    '90114ef3-655c-44ea-be08-cf77678ad66c',  // TEST COMPANY - À SUPPRIMER 2
    '4bf6701a-50f8-4fff-a558-e2f4ce4eda23'   // Jean TEST (person)
  ];

  for (const id of testIds) {
    try {
      await restRequest('DELETE', `/rest/companies/${id}`);
      await restRequest('DELETE', `/rest/people/${id}`);
    } catch (e) {
      // Ignorer les erreurs (l'ID peut ne pas exister)
    }
  }
  console.log('  ✅ Test companies supprimées');

  console.log('\n✅ Nettoyage terminé !');
}

main().catch(console.error);
