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
  const mappings = JSON.parse(fs.readFileSync('mappings.json', 'utf-8'));
  const firstCompanyId = Object.values(mappings.companies)[0];

  console.log('🧪 TEST 1: Sans createdAt\n');
  let body = {
    name: 'TEST-DATE-1',
    companyId: firstCompanyId,
    stage: 'DEVIS_ENVOYE'
  };
  console.log('Body:', JSON.stringify(body, null, 2));
  let result = await restRequest('POST', '/rest/opportunities', body);
  console.log(`Status: ${result.statusCode}`);
  if (result.statusCode === 201 || result.statusCode === 200) {
    console.log('✅ Créé avec succès');
    const id = result.data.data?.createOpportunity?.id || result.data.data?.id;
    if (id) await restRequest('DELETE', `/rest/opportunities/${id}`);
  } else {
    console.log('❌ Erreur:', JSON.stringify(result.data, null, 2));
  }

  console.log('\n🧪 TEST 2: Avec createdAt\n');
  body = {
    name: 'TEST-DATE-2',
    companyId: firstCompanyId,
    stage: 'DEVIS_ENVOYE',
    createdAt: '2023-01-15T00:00:00Z'
  };
  console.log('Body:', JSON.stringify(body, null, 2));
  result = await restRequest('POST', '/rest/opportunities', body);
  console.log(`Status: ${result.statusCode}`);
  if (result.statusCode === 201 || result.statusCode === 200) {
    console.log('✅ Créé avec succès');
    const opp = result.data.data?.createOpportunity || result.data.data;
    console.log('createdAt dans la réponse:', opp.createdAt);
    const id = opp.id;
    if (id) await restRequest('DELETE', `/rest/opportunities/${id}`);
  } else {
    console.log('❌ Erreur:', JSON.stringify(result.data, null, 2));
  }
}

main().catch(console.error);
