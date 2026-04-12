#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

function rest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Parse error: ${body.substring(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const mappings = JSON.parse(fs.readFileSync('mappings.json', 'utf-8'));
  const firstCompanyId = Object.values(mappings.companies)[0];

  console.log('🔍 Vérification du champ "Créé par"...\n');
  console.log('ID de la company:', firstCompanyId);

  const result = await rest(`/rest/companies/${firstCompanyId}`);

  const company = result.data?.company;

  if (company) {
    console.log('\n📦 Company:', company.name);
    console.log('   Créé le:', company.createdAt);
    console.log('   Créé par:', JSON.stringify(company.createdBy, null, 2));

    if (company.createdBy && company.createdBy.name === 'Alexandra') {
      console.log('\n✅ SUCCESS - "Alexandra" est bien enregistré comme créateur !');
    } else {
      console.log('\n⚠️  Le créateur est:', company.createdBy?.name || 'N/A');
      console.log('   (Attendu: "Alexandra")');
    }
  } else {
    console.log('❌ Erreur:', JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
