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

async function updateCompany(companyId, newPostalCode) {
  const mutation = `
    mutation UpdateCompanies($filter: CompanyFilterInput!, $data: CompanyUpdateInput!) {
      updateCompanies(filter: $filter, data: $data) {
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
    filter: { id: { eq: companyId } },
    data: {
      address: {
        addressPostcode: newPostalCode
      }
    }
  };

  const result = await graphql(mutation, variables);
  return result.updateCompanies[0];
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
  return result.companies.edges[0]?.node;
}

async function main() {
  console.log('🧪 TEST DE MODIFICATION DE COMPANIES');
  console.log('=' .repeat(80));

  // Utiliser les companies créées dans le test précédent
  const modificationsTests = [
    {
      id: '6a322162-fcda-41d5-88f5-829c833bf1ba',
      oldCp: '13000',
      newCp: '06000',
      expected: { numero: '06', code: 'DEPT_06_ALPES_MARITIMES', label: '06 - Alpes-Maritimes' }
    },
    {
      id: 'fdee11bf-c223-4750-a347-1cc7a6a2ee0b',
      oldCp: '48000',
      newCp: '29200',
      expected: { numero: '29', code: 'DEPT_29_FINIST_RE', label: '29 - Finistère' }
    },
    {
      id: 'e114646d-cac6-413c-881f-30c86fa9d4e8',
      oldCp: '69001',
      newCp: '38000',
      expected: { numero: '38', code: 'DEPT_38_IS_RE', label: '38 - Isère' }
    }
  ];

  let successCount = 0;
  let totalCount = 0;

  for (const test of modificationsTests) {
    try {
      console.log(`\n🔨 Modification company ${test.id.substring(0, 8)}...`);
      console.log(`   CP: ${test.oldCp} → ${test.newCp}`);

      const updated = await updateCompany(test.id, test.newCp);
      console.log(`   ✅ Modification effectuée`);

      // Attendre que le workflow s'exécute
      console.log('   ⏳ Attente workflow (4s)...');
      await delay(4000);

      // Vérifier le résultat
      const final = await getCompany(test.id);

      console.log(`\n   📊 Résultat:`);
      console.log(`      Code postal: ${final.address?.addressPostcode}`);
      console.log(`      Département: ${final.departement || '❌ NULL'}`);
      console.log(`      N° Département: ${final.departementNumero || '❌ NULL'}`);

      const success = final.departement === test.expected.code &&
                      final.departementNumero === test.expected.numero;

      totalCount++;
      if (success) {
        successCount++;
        console.log(`      ✅ CORRECT - ${test.expected.label}`);
      } else {
        console.log(`      ❌ INCORRECT`);
        console.log(`      → Attendu: ${test.expected.code} / ${test.expected.numero}`);
        console.log(`      → Reçu: ${final.departement || 'NULL'} / ${final.departementNumero || 'NULL'}`);
      }

    } catch (error) {
      console.error(`\n   ❌ Erreur:`, error.message);
      totalCount++;
    }

    // Pause entre les tests
    await delay(1000);
  }

  console.log('\n' + '=' .repeat(80));
  console.log('📊 RÉSUMÉ');
  console.log('=' .repeat(80));
  console.log(`\nTests réussis: ${successCount}/${totalCount}`);
  console.log(`Taux de réussite: ${Math.round((successCount / totalCount) * 100)}%`);

  if (successCount === totalCount) {
    console.log('\n🎉 TOUS LES TESTS DE MODIFICATION SONT PASSÉS !');
  } else {
    console.log(`\n⚠️  ${totalCount - successCount} test(s) ont échoué`);
  }

  console.log('\n' + '=' .repeat(80));
}

main().catch(console.error);
