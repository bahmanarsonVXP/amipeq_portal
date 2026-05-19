const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = process.env.TWENTY_BASE_URL || 'https://twenty-production-7352.up.railway.app';
const API_KEY = process.env.TWENTY_API_KEY || '';

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { resolve(body); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Get OpenAPI spec
  console.log('Fetching Open API spec...');
  const spec = await apiGet('/open-api/core');
  // Just look at the Company schema
  const schemas = spec.components?.schemas || {};
  const companySchema = schemas['Company'] || schemas['company'];
  if (companySchema) {
    console.log('\n=== Company Schema ===');
    console.log(JSON.stringify(companySchema.properties, null, 2).substring(0, 3000));
  }

  // Also look at Person schema
  const personSchema = schemas['Person'] || schemas['person'];
  if (personSchema) {
    console.log('\n=== Person Schema ===');
    console.log(JSON.stringify(personSchema.properties, null, 2).substring(0, 3000));
  }

  // List schemas to find the right name
  if (!companySchema) {
    console.log('\nAvailable schemas:');
    console.log(Object.keys(schemas).filter(k => k.toLowerCase().includes('comp') || k.toLowerCase().includes('person') || k.toLowerCase().includes('phone')).join('\n'));
    console.log('\nAll schemas:');
    console.log(Object.keys(schemas).join(', '));
  }

  // Try creating a company without phones to understand the structure
  console.log('\n=== Test: GET first company ===');
  const companies = await apiGet('/rest/companies?limit=1');
  console.log(JSON.stringify(companies, null, 2).substring(0, 3000));
}

main().catch(console.error);
