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

async function testValue(value, label) {
  const mappings = JSON.parse(fs.readFileSync('mappings.json', 'utf-8'));
  const firstCompanyId = Object.values(mappings.companies)[0];

  const body = {
    name: `TEST-MODALITE-${label}`,
    companyId: firstCompanyId,
    stage: 'DEVIS_ENVOYE',
    modalite: value
  };

  const result = await restRequest('POST', '/rest/opportunities', body);
  
  if (result.statusCode === 201 || result.statusCode === 200) {
    console.log(`✅ '${value}' accepté (${label})`);
    const id = result.data.data?.createOpportunity?.id || result.data.data?.id;
    if (id) {
      await restRequest('DELETE', `/rest/opportunities/${id}`);
    }
    return true;
  } else {
    console.log(`❌ '${value}' rejeté (${label})`);
    return false;
  }
}

async function main() {
  console.log('🧪 TEST DES VALEURS POUR modalite\n');
  
  const tests = [
    ['DISTANCIEL', 'Distanciel'],
    ['PRESENTIEL', 'Présentiel'],
    ['DISTANCE', 'Distance'],
    ['PRESENCE', 'Présence'],
    [null, 'NULL'],
    ['', 'Chaîne vide']
  ];

  for (const [value, label] of tests) {
    await testValue(value, label);
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n✅ Tests terminés');
}

main().catch(console.error);
