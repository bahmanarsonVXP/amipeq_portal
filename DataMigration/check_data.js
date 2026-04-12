#!/usr/bin/env node
const https = require('https');
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
  console.log('🔍 Vérification des données dans TWENTY...\n');

  try {
    const companies = await rest('/rest/companies?limit=1000');
    const companyCount = companies.data?.edges?.length || 0;
    console.log(`📦 Companies: ${companyCount} trouvées`);

    if (companyCount > 0) {
      const recent = companies.data.edges.slice(0, 3);
      console.log('\n📋 Exemples récents:');
      recent.forEach((edge, i) => {
        const c = edge.node;
        console.log(`  ${i + 1}. ${c.name} (N°${c.numeroSociete || 'N/A'}) - Dept: ${c.departementNumero || 'N/A'}`);
      });
    }
  } catch (err) {
    console.error('❌ Erreur companies:', err.message);
  }

  try {
    const persons = await rest('/rest/people?limit=1000');
    const personCount = persons.data?.edges?.length || 0;
    console.log(`\n👤 Persons: ${personCount} trouvées`);
  } catch (err) {
    console.error('❌ Erreur persons:', err.message);
  }

  try {
    const opps = await rest('/rest/opportunities?limit=1000');
    const oppCount = opps.data?.edges?.length || 0;
    console.log(`💼 Opportunities: ${oppCount} trouvées`);
  } catch (err) {
    console.error('❌ Erreur opportunities:', err.message);
  }
}

main().catch(console.error);
