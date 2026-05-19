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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const testCases = [
  { cp: '13000', expected: { numero: '13', code: 'DEPT_13_BOUCHES_DU_RHONE', label: '13 - Bouches-du-Rhône' } },
  { cp: '48000', expected: { numero: '48', code: 'DEPT_48_LOZERE', label: '48 - Lozère' } },
  { cp: '12300', expected: { numero: '12', code: 'DEPT_12_AVEYRON', label: '12 - Aveyron' } }
];

async function createTestCompany(testCase) {
  const mutation = `
    mutation CreateCompany($data: CompanyCreateInput!) {
      createCompany(data: $data) {
        id
        name
        address {
          addressPostcode
          addressCity
        }
        departement
        departementNumero
        createdAt
      }
    }
  `;

  const variables = {
    data: {
      name: `TEST CP ${testCase.cp}`,
      address: {
        addressPostcode: testCase.cp,
        addressCity: `Test ${testCase.expected.label}`,
        addressStreet1: '1 rue Test',
        addressCountry: 'France'
      }
    }
  };

  console.log(`\n📝 Création company CP ${testCase.cp}...`);
  const result = await graphql(mutation, variables);
  return result.createCompany;
}

async function checkCompany(companyId, testCase) {
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

  const result = await graphql(query, { filter: { id: { eq: companyId } } });
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

    const success = dept === testCase.expected.code && deptNum === testCase.expected.numero;

    if (success) {
      console.log(`   ✅ CORRECT - ${testCase.expected.label}`);
    } else {
      console.log(`   ❌ INCORRECT`);
      console.log(`   → Attendu: ${testCase.expected.code} / ${testCase.expected.numero}`);
      console.log(`   → Reçu: ${dept || 'NULL'} / ${deptNum || 'NULL'}`);
    }

    return { success, company };
  } else {
    console.log(`\n❌ Company non trouvée`);
    return { success: false, company: null };
  }
}

async function main() {
  console.log('🧪 TEST DES CODES POSTAUX: 13000, 48000, 12300');
  console.log('=' .repeat(80));

  const results = [];

  for (const testCase of testCases) {
    try {
      // Créer la company
      const company = await createTestCompany(testCase);
      console.log(`✅ Créée: ${company.name} (ID: ${company.id})`);
      console.log(`   Département initial: ${company.departement || 'NULL'}`);
      console.log(`   N° Département initial: ${company.departementNumero || 'NULL'}`);

      results.push({ company, testCase });

      // Attendre 3 secondes pour le workflow
      console.log('   ⏳ Attente workflow (3s)...');
      await delay(3000);

    } catch (error) {
      console.error(`❌ Erreur création CP ${testCase.cp}:`, error.message);
    }
  }

  // Vérifier les résultats finaux
  console.log('\n' + '=' .repeat(80));
  console.log('🔍 VÉRIFICATION FINALE APRÈS WORKFLOW');
  console.log('=' .repeat(80));

  let allSuccess = true;
  for (const { company, testCase } of results) {
    const { success } = await checkCompany(company.id, testCase);
    if (!success) allSuccess = false;
  }

  console.log('\n' + '=' .repeat(80));
  if (allSuccess) {
    console.log('✅ TOUS LES TESTS SONT PASSÉS !');
  } else {
    console.log('❌ CERTAINS TESTS ONT ÉCHOUÉ');
  }
  console.log('=' .repeat(80));

  console.log('\n💡 IDs pour nettoyage:');
  results.forEach(({ company, testCase }) => {
    console.log(`   ${testCase.cp}: ${company.id}`);
  });
}

main().catch(console.error);
