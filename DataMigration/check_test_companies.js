#!/usr/bin/env node
const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

function graphql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('/graphql', BASE_URL);
    const payload = JSON.stringify({ query, variables });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.errors) {
            reject(new Error(JSON.stringify(parsed.errors, null, 2)));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body.substring(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const testCompanies = [
  { id: 'c19ef776-deb6-4e9a-b590-c69fad1d7c41', cp: '49000', expected: { numero: '49', code: 'DEPT_49_MAINE_ET_LOIRE' } },
  { id: 'e2051fc2-cc9f-4751-a0ae-21b53e4f16ad', cp: '92400', expected: { numero: '92', code: 'DEPT_92_HAUTS_DE_SEINE' } },
  { id: '3942d6e6-0202-41ed-8f9d-4d39a6594a66', cp: '27340', expected: { numero: '27', code: 'DEPT_27_EURE' } }
];

async function main() {
  const query = `
    query GetCompanies($filter: CompanyFilterInput!) {
      companies(filter: $filter) {
        edges {
          node {
            id
            name
            address {
              addressPostcode
            }
            departement
            departementNumero
            updatedAt
          }
        }
      }
    }
  `;

  console.log('🔍 VÉRIFICATION DES COMPANIES DE TEST\n');
  console.log('=' .repeat(80));

  for (const test of testCompanies) {
    try {
      const result = await graphql(query, { filter: { id: { eq: test.id } } });
      const company = result.companies.edges[0]?.node;

      if (company) {
        const cp = company.address?.addressPostcode;
        const dept = company.departement;
        const deptNum = company.departementNumero;

        console.log(`\n📊 Company: ${company.name}`);
        console.log(`   ID: ${company.id}`);
        console.log(`   Code postal: ${cp || '❌ NULL'}`);
        console.log(`   Département: ${dept || '❌ NULL'}`);
        console.log(`   N° Département: ${deptNum || '❌ NULL'}`);
        console.log(`   Mis à jour: ${company.updatedAt}`);

        const success = dept === test.expected.code && deptNum === test.expected.numero;

        if (success) {
          console.log(`   ✅ CORRECT`);
        } else {
          console.log(`   ❌ INCORRECT`);
          console.log(`   → Attendu: ${test.expected.code} / ${test.expected.numero}`);
          console.log(`   → Reçu: ${dept || 'NULL'} / ${deptNum || 'NULL'}`);
        }
      } else {
        console.log(`\n❌ Company ${test.id} non trouvée`);
      }
    } catch (error) {
      console.error(`❌ Erreur pour ${test.id}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(80));
}

main().catch(console.error);
