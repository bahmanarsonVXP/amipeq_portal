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

  console.log('🧪 TEST COMPLET avec tous les champs\n');
  
  const body = {
    name: 'TEST-FULL',
    companyId: firstCompanyId,
    amount: {
      amountMicros: 1500000000,
      currencyCode: 'EUR'
    },
    stage: 'DEVIS_ENVOYE',
    numeroDevis: 'TEST-123',
    dateDevis: '2023-06-15T00:00:00Z',
    prestation: ['DUERP'],
    naturePrestation: null,
    modalite: null,
    montantRemise: {
      amountMicros: 300000000,
      currencyCode: 'EUR'
    },
    tauxRemise: 20,
    statutDevis: 'EN_ATTENTE',
    anneeDevis: 2023,
    normeOriginale: 'DUERP',
    dateEnvoiDocs: null,
    createdAt: '2023-06-15T00:00:00Z',
    createdBy: {
      source: "IMPORT",
      workspaceMemberId: null,
      name: "Alexandra",
      context: {}
    }
  };

  console.log('Body:', JSON.stringify(body, null, 2));
  const result = await restRequest('POST', '/rest/opportunities', body);
  console.log(`\nStatus: ${result.statusCode}`);
  
  if (result.statusCode === 201 || result.statusCode === 200) {
    console.log('✅ Créé avec succès');
    const id = result.data.data?.createOpportunity?.id || result.data.data?.id;
    console.log('ID:', id);
    if (id) await restRequest('DELETE', `/rest/opportunities/${id}`);
  } else {
    console.log('❌ Erreur:');
    console.log(JSON.stringify(result.data, null, 2));
  }
}

main().catch(console.error);
