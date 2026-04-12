#!/usr/bin/env node
const https = require('https');
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
  console.log('🧪 Test de création d\'une company...\n');

  const testCompany = {
    name: 'TEST COMPANY - À SUPPRIMER 2',
    address: {
      addressStreet1: '123 Rue Test',
      addressStreet2: null,
      addressCity: 'Paris',
      addressPostcode: '75001',
      addressCountry: 'France'
    },
    numeroSociete: 999998,
    typeClient: 'ENTREPRISE_TPE_PME',
    departement: 'DEPT_75_PARIS',
    departementNumero: '75',
    prospecteur: 'ALEX'
  };

  console.log('📤 Envoi de la requête...');
  console.log(JSON.stringify(testCompany, null, 2));

  const result = await restRequest('POST', '/rest/companies', testCompany);

  console.log('\n📥 Réponse:');
  console.log('Status:', result.statusCode);
  console.log('Data:', JSON.stringify(result.data, null, 2));

  if (result.statusCode === 201 || result.statusCode === 200) {
    console.log('\n✅ Succès ! Company créée avec ID:', result.data.data?.id);
  } else {
    console.log('\n❌ Échec !');
  }
}

main().catch(console.error);
