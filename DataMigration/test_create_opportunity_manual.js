#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

function restRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🧪 TEST MANUEL CRÉATION OPPORTUNITY\n');
  console.log('=' .repeat(80));

  // Récupérer une company existante
  const mappings = JSON.parse(fs.readFileSync('mappings.json', 'utf-8'));
  const firstCompanyId = Object.values(mappings.companies)[0];

  console.log(`\n📦 Company ID pour le test: ${firstCompanyId}\n`);

  const testBody = {
    name: 'TEST-MONTANT-12345',
    companyId: firstCompanyId,
    amount: {
      amountMicros: 1500000000, // 1500 EUR
      currencyCode: 'EUR'
    },
    montantRemise: {
      amountMicros: 300000000, // 300 EUR
      currencyCode: 'EUR'
    },
    tauxRemise: 20,
    stage: 'DEVIS_ENVOYE'
  };

  console.log('📝 Body envoyé:');
  console.log(JSON.stringify(testBody, null, 2));

  console.log('\n🚀 Création de l\'opportunity...\n');

  const result = await restRequest('POST', '/rest/opportunities', testBody);

  console.log(`Status: ${result.statusCode}`);
  console.log('\nRéponse:');
  console.log(JSON.stringify(result.data, null, 2));

  if (result.statusCode === 201 || result.statusCode === 200) {
    const id = result.data.data?.createOpportunity?.id || result.data.data?.id;
    console.log(`\n✅ Opportunity créée avec ID: ${id}`);
  } else {
    console.log('\n❌ Échec de la création');
  }

  console.log('\n' + '=' .repeat(80));
}

main().catch(console.error);
