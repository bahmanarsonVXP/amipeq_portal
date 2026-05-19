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

async function main() {
  const query = `
    query {
      companies(first: 50, orderBy: [{ createdAt: DescNullsLast }]) {
        edges {
          node {
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
      }
    }
  `;

  console.log('🔍 VÉRIFICATION DES DÉPARTEMENTS IMPORTÉS\n');
  console.log('=' .repeat(80));

  try {
    const result = await graphql(query);
    const companies = result.companies.edges;

    console.log(`\n📦 ${companies.length} companies trouvées\n`);

    let withDept = 0;
    let withoutDept = 0;
    let withPostcode = 0;
    let withoutPostcode = 0;

    const sample = [];

    companies.forEach((edge, idx) => {
      const company = edge.node;
      const cp = company.address?.addressPostcode;
      const dept = company.departement;
      const deptNum = company.departementNumero;

      if (cp) withPostcode++;
      else withoutPostcode++;

      if (dept && deptNum) withDept++;
      else withoutDept++;

      // Garder les 10 premières pour affichage
      if (idx < 10) {
        sample.push({
          name: company.name,
          cp: cp || 'N/A',
          dept: dept || 'NULL',
          deptNum: deptNum || 'NULL'
        });
      }
    });

    console.log('📊 STATISTIQUES:\n');
    console.log(`   Companies avec code postal: ${withPostcode}`);
    console.log(`   Companies sans code postal: ${withoutPostcode}`);
    console.log(`   Companies avec département: ${withDept} (${Math.round((withDept/companies.length)*100)}%)`);
    console.log(`   Companies sans département: ${withoutDept}`);

    console.log('\n\n📋 ÉCHANTILLON (10 premières companies):\n');
    sample.forEach((s, idx) => {
      const status = s.dept !== 'NULL' ? '✅' : '❌';
      console.log(`${idx + 1}. ${status} ${s.name}`);
      console.log(`   CP: ${s.cp} → Dept: ${s.dept} / N°: ${s.deptNum}`);
    });

    console.log('\n' + '=' .repeat(80));

    if (withDept === companies.length) {
      console.log('\n🎉 PARFAIT ! Toutes les companies ont leur département calculé !');
    } else if (withDept > 0) {
      console.log(`\n⚠️  ${withDept}/${companies.length} companies ont leur département`);
      console.log(`   ${withoutDept} companies n'ont pas de département`);
      if (withoutPostcode > 0) {
        console.log(`   → ${withoutPostcode} companies n'ont pas de code postal (normal)`);
      }
    } else {
      console.log('\n❌ PROBLÈME : Aucune company n\'a de département !');
      console.log('   Le workflow ne s\'est peut-être pas exécuté.');
    }

    console.log('\n' + '=' .repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

main().catch(console.error);
