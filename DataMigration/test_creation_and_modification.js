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
  { cp: '13000', expected: { numero: '13', code: 'DEPT_13_BOUCHES_DU_RH_NE', label: '13 - Bouches-du-Rhône' } },
  { cp: '48000', expected: { numero: '48', code: 'DEPT_48_LOZ_RE', label: '48 - Lozère' } },
  { cp: '69001', expected: { numero: '69', code: 'DEPT_69_RH_NE', label: '69 - Rhône' } },
  { cp: '34000', expected: { numero: '34', code: 'DEPT_34_H_RAULT', label: '34 - Hérault' } },
  { cp: '75001', expected: { numero: '75', code: 'DEPT_75_PARIS', label: '75 - Paris' } }
];

async function createCompany(testCase) {
  const mutation = `
    mutation CreateCompany($data: CompanyCreateInput!) {
      createCompany(data: $data) {
        id
        name
        address {
          addressPostcode
        }
        departement
        departementNumero
        createdAt
      }
    }
  `;

  const variables = {
    data: {
      name: `TEST CRÉATION CP ${testCase.cp}`,
      address: {
        addressPostcode: testCase.cp,
        addressCity: `Test ${testCase.expected.label}`,
        addressStreet1: '1 rue Test',
        addressCountry: 'France'
      }
    }
  };

  const result = await graphql(mutation, variables);
  return result.createCompany;
}

async function updateCompany(companyId, newPostalCode, testCase) {
  const mutation = `
    mutation UpdateCompany($id: ID!, $data: CompanyUpdateInput!) {
      updateCompany(id: $id, data: $data) {
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

  const variables = {
    id: companyId,
    data: {
      address: {
        addressPostcode: newPostalCode
      }
    }
  };

  const result = await graphql(mutation, variables);
  return result.updateCompany;
}

async function getCompany(companyId) {
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
  return company;
}

function checkResult(company, expected, testName) {
  const cp = company.address?.addressPostcode;
  const dept = company.departement;
  const deptNum = company.departementNumero;

  console.log(`\n📊 ${testName}`);
  console.log(`   Nom: ${company.name}`);
  console.log(`   Code postal: ${cp}`);
  console.log(`   Département: ${dept || '❌ NULL'}`);
  console.log(`   N° Département: ${deptNum || '❌ NULL'}`);
  console.log(`   Mis à jour: ${company.updatedAt}`);

  const success = dept === expected.code && deptNum === expected.numero;

  if (success) {
    console.log(`   ✅ CORRECT - Attendu: ${expected.label}`);
  } else {
    console.log(`   ❌ INCORRECT`);
    console.log(`   → Attendu: ${expected.code} / ${expected.numero}`);
    console.log(`   → Reçu: ${dept || 'NULL'} / ${deptNum || 'NULL'}`);
  }

  return success;
}

async function main() {
  console.log('🧪 TEST CRÉATION ET MODIFICATION DE COMPANIES');
  console.log('=' .repeat(80));

  let totalTests = 0;
  let successfulTests = 0;
  const createdCompanies = [];

  // ============================================================================
  // PARTIE 1: TEST DE CRÉATION
  // ============================================================================
  console.log('\n📝 PARTIE 1: TEST DE CRÉATION');
  console.log('=' .repeat(80));

  for (const testCase of testCases) {
    try {
      console.log(`\n🔨 Création company avec CP ${testCase.cp}...`);
      const company = await createCompany(testCase);
      console.log(`   ✅ Créée: ${company.name} (ID: ${company.id})`);

      createdCompanies.push({ id: company.id, testCase });

      // Attendre que le workflow s'exécute
      console.log('   ⏳ Attente workflow (4s)...');
      await delay(4000);

      // Vérifier le résultat
      const updated = await getCompany(company.id);
      totalTests++;
      if (checkResult(updated, testCase.expected, 'Résultat après création')) {
        successfulTests++;
      }

    } catch (error) {
      console.error(`\n❌ Erreur création CP ${testCase.cp}:`, error.message);
      totalTests++;
    }

    // Pause entre les tests
    await delay(1000);
  }

  // ============================================================================
  // PARTIE 2: TEST DE MODIFICATION
  // ============================================================================
  console.log('\n\n✏️  PARTIE 2: TEST DE MODIFICATION');
  console.log('=' .repeat(80));

  // Modifier les 3 premières companies créées avec de nouveaux codes postaux
  const modificationsTests = [
    { companyIndex: 0, newCp: '06000', expected: { numero: '06', code: 'DEPT_06_ALPES_MARITIMES', label: '06 - Alpes-Maritimes' } },
    { companyIndex: 1, newCp: '29200', expected: { numero: '29', code: 'DEPT_29_FINIST_RE', label: '29 - Finistère' } },
    { companyIndex: 2, newCp: '38000', expected: { numero: '38', code: 'DEPT_38_IS_RE', label: '38 - Isère' } }
  ];

  for (const modTest of modificationsTests) {
    if (modTest.companyIndex >= createdCompanies.length) continue;

    const companyToModify = createdCompanies[modTest.companyIndex];

    try {
      console.log(`\n🔨 Modification company ${companyToModify.id.substring(0, 8)}...`);
      console.log(`   Changement CP: ${companyToModify.testCase.cp} → ${modTest.newCp}`);

      const updated = await updateCompany(companyToModify.id, modTest.newCp, modTest);
      console.log(`   ✅ Modifiée`);

      // Attendre que le workflow s'exécute
      console.log('   ⏳ Attente workflow (4s)...');
      await delay(4000);

      // Vérifier le résultat
      const final = await getCompany(companyToModify.id);
      totalTests++;
      if (checkResult(final, modTest.expected, 'Résultat après modification')) {
        successfulTests++;
      }

    } catch (error) {
      console.error(`\n❌ Erreur modification:`, error.message);
      totalTests++;
    }

    // Pause entre les tests
    await delay(1000);
  }

  // ============================================================================
  // RÉSUMÉ
  // ============================================================================
  console.log('\n\n' + '=' .repeat(80));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('=' .repeat(80));
  console.log(`\nTests réussis: ${successfulTests}/${totalTests}`);
  console.log(`Taux de réussite: ${Math.round((successfulTests / totalTests) * 100)}%`);

  if (successfulTests === totalTests) {
    console.log('\n🎉 TOUS LES TESTS SONT PASSÉS !');
    console.log('   ✅ Création de companies: OK');
    console.log('   ✅ Modification de companies: OK');
    console.log('   ✅ Le workflow fonctionne parfaitement !');
  } else {
    console.log(`\n⚠️  ${totalTests - successfulTests} test(s) ont échoué`);
  }

  console.log('\n💡 IDs des companies créées (pour nettoyage):');
  createdCompanies.forEach(({ id, testCase }) => {
    console.log(`   ${testCase.cp}: ${id}`);
  });

  console.log('\n' + '=' .repeat(80));
}

main().catch(console.error);
