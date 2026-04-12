#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
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
  { cp: '49000', expected: { numero: '49', code: 'DEPT_49_MAINE_ET_LOIRE', label: '49 - Maine-et-Loire' } },
  { cp: '92400', expected: { numero: '92', code: 'DEPT_92_HAUTS_DE_SEINE', label: '92 - Hauts-de-Seine' } },
  { cp: '27340', expected: { numero: '27', code: 'DEPT_27_EURE', label: '27 - Eure' } }
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
          addressStreet1
        }
        departement
        departementNumero
        createdAt
      }
    }
  `;

  const variables = {
    data: {
      name: `TEST WORKFLOW CP ${testCase.cp}`,
      address: {
        addressPostcode: testCase.cp,
        addressCity: `Test City ${testCase.cp}`,
        addressStreet1: '123 Test Street',
        addressCountry: 'France'
      }
    }
  };

  console.log(`\n📝 Création de la company avec CP ${testCase.cp}...`);
  const result = await graphql(mutation, variables);
  return result.createCompany;
}

async function checkCompany(companyId) {
  const query = `
    query GetCompany($filter: CompanyFilterInput!) {
      company(filter: $filter) {
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
  `;

  const result = await graphql(query, { filter: { id: { eq: companyId } } });
  const company = result.company;
  // Flatten address for easier display
  return {
    ...company,
    addressPostcode: company.address?.addressPostcode
  };
}

async function checkWorkflowRuns() {
  const query = `
    query {
      workflowRuns(orderBy: [{ createdAt: DescNullsLast }], first: 10) {
        edges {
          node {
            id
            name
            status
            startedAt
            output
            workflowVersion {
              name
            }
          }
        }
      }
    }
  `;

  const result = await graphql(query);
  return result.workflowRuns.edges;
}

async function main() {
  console.log('🧪 TEST DES CODES POSTAUX: 49000, 92400, 27340\n');
  console.log('=' .repeat(80));

  const createdCompanies = [];

  // 1. Créer les 3 companies
  for (const testCase of testCases) {
    try {
      const company = await createTestCompany(testCase);
      console.log(`✅ Company créée: ${company.name}`);
      console.log(`   ID: ${company.id}`);
      console.log(`   CP: ${company.address?.addressPostcode}`);
      console.log(`   Département: ${company.departement || '❌ NULL'}`);
      console.log(`   N° Département: ${company.departementNumero || '❌ NULL'}`);

      createdCompanies.push({ company, testCase });

      await delay(2000); // Attendre 2s pour le workflow
    } catch (error) {
      console.error(`❌ Erreur création company CP ${testCase.cp}:`, error.message);
    }
  }

  // 2. Attendre que les workflows s'exécutent
  console.log('\n⏳ Attente de 10 secondes pour l\'exécution des workflows...\n');
  await delay(10000);

  // 3. Vérifier les résultats
  console.log('=' .repeat(80));
  console.log('🔍 VÉRIFICATION DES RÉSULTATS\n');

  for (const { company, testCase } of createdCompanies) {
    try {
      const updated = await checkCompany(company.id);
      console.log(`\n📊 Company: ${updated.name}`);
      console.log(`   Code postal: ${updated.addressPostcode}`);
      console.log(`   Département: ${updated.departement || '❌ NULL'}`);
      console.log(`   N° Département: ${updated.departementNumero || '❌ NULL'}`);
      console.log(`   Mis à jour: ${updated.updatedAt}`);

      const success = updated.departement === testCase.expected.code &&
                      updated.departementNumero === testCase.expected.numero;

      if (success) {
        console.log(`   ✅ CORRECT - Attendu: ${testCase.expected.label}`);
      } else {
        console.log(`   ❌ INCORRECT`);
        console.log(`   Attendu: ${testCase.expected.code} / ${testCase.expected.numero}`);
        console.log(`   Reçu: ${updated.departement || 'NULL'} / ${updated.departementNumero || 'NULL'}`);
      }
    } catch (error) {
      console.error(`❌ Erreur vérification:`, error.message);
    }
  }

  // 4. Vérifier les exécutions de workflow
  console.log('\n' + '='.repeat(80));
  console.log('🔄 DERNIÈRES EXÉCUTIONS DE WORKFLOW\n');

  try {
    const runs = await checkWorkflowRuns();
    runs.slice(0, 5).forEach((edge, idx) => {
      const run = edge.node;
      console.log(`${idx + 1}. ${run.workflowVersion?.name || 'N/A'}`);
      console.log(`   Status: ${run.status}`);
      console.log(`   Démarré: ${run.startedAt}`);
      console.log(`   Output: ${run.output || 'null'}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Erreur récupération workflows:', error.message);
  }

  console.log('=' .repeat(80));
  console.log('\n💡 IDs des companies créées (pour nettoyage):');
  createdCompanies.forEach(({ company, testCase }) => {
    console.log(`   ${testCase.cp}: ${company.id}`);
  });
}

main().catch(console.error);
