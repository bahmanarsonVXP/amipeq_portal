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
  console.log('🧪 Test de création d\'une Person...\n');

  // Utiliser l'ID de la company test créée précédemment
  const testPerson = {
    name: {
      firstName: "Jean",
      lastName: "TEST"
    },
    emails: {
      primaryEmail: "jean.test@example.com",
      additionalEmails: []
    },
    phones: {
      primaryPhoneNumber: "0612345678",
      primaryPhoneCountryCode: "FR",
      additionalPhones: []
    },
    city: "Paris",
    companyId: "90114ef3-655c-44ea-be08-cf77678ad66c"  // ID de TEST COMPANY - À SUPPRIMER 2
  };

  console.log('📤 Envoi de la requête...');
  console.log(JSON.stringify(testPerson, null, 2));

  const result = await restRequest('POST', '/rest/people', testPerson);

  console.log('\n📥 Réponse:');
  console.log('Status:', result.statusCode);

  if (result.statusCode === 201 || result.statusCode === 200) {
    console.log('\n✅ Succès ! Person créée avec ID:', result.data.data?.createPerson?.id || result.data.data?.id);
    console.log('\nDétails:');
    console.log('  Nom:', result.data.data?.createPerson?.name || result.data.data?.name);
    console.log('  Email:', result.data.data?.createPerson?.emails || result.data.data?.emails);
    console.log('  Phone:', result.data.data?.createPerson?.phones || result.data.data?.phones);
  } else {
    console.log('\n❌ Échec !');
    console.log('Data:', JSON.stringify(result.data, null, 2));
  }
}

main().catch(console.error);
