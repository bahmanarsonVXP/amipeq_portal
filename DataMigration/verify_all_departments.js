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

async function getAllCompanies() {
  let allCompanies = [];
  let hasMore = true;
  let cursor = null;

  while (hasMore) {
    const query = `
      query GetCompanies($after: String) {
        companies(first: 100, after: $after) {
          edges {
            cursor
            node {
              id
              name
              address {
                addressPostcode
              }
              departement
              departementNumero
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const result = await graphql(query, { after: cursor });
    const edges = result.companies.edges;

    allCompanies = allCompanies.concat(edges.map(e => e.node));

    hasMore = result.companies.pageInfo.hasNextPage;
    cursor = result.companies.pageInfo.endCursor;
  }

  return allCompanies;
}

async function main() {
  console.log('🔍 VÉRIFICATION COMPLÈTE DES DÉPARTEMENTS\n');
  console.log('=' .repeat(80));
  console.log('\n⏳ Récupération de toutes les companies...\n');

  try {
    const companies = await getAllCompanies();

    console.log(`📦 ${companies.length} companies récupérées\n`);
    console.log('=' .repeat(80));

    let withPostcode = 0;
    let withoutPostcode = 0;
    let withDept = 0;
    let withoutDept = 0;
    let withDeptButNoPostcode = 0;

    const missingDept = [];

    companies.forEach(company => {
      const cp = company.address?.addressPostcode;
      const dept = company.departement;
      const deptNum = company.departementNumero;

      if (cp) {
        withPostcode++;
        if (dept && deptNum) {
          withDept++;
        } else {
          withoutDept++;
          missingDept.push({ name: company.name, cp });
        }
      } else {
        withoutPostcode++;
        if (dept && deptNum) {
          withDeptButNoPostcode++;
        }
      }
    });

    console.log('\n📊 STATISTIQUES GLOBALES:\n');
    console.log(`   Total companies: ${companies.length}`);
    console.log(`   Companies avec code postal: ${withPostcode}`);
    console.log(`   Companies sans code postal: ${withoutPostcode}`);
    console.log(`   Companies avec département: ${withDept} / ${withPostcode} (${Math.round((withDept/withPostcode)*100)}%)`);
    console.log(`   Companies sans département: ${withoutDept}`);

    if (withDeptButNoPostcode > 0) {
      console.log(`   ⚠️  Companies avec département mais sans CP: ${withDeptButNoPostcode}`);
    }

    console.log('\n' + '=' .repeat(80));

    if (withDept === withPostcode) {
      console.log('\n🎉 PARFAIT ! Toutes les companies avec code postal ont leur département !');
      console.log('   Le workflow a fonctionné à 100% !');
    } else {
      console.log(`\n⚠️  ${withoutDept} companies avec code postal n'ont PAS de département\n`);

      if (missingDept.length > 0) {
        console.log('📋 Companies sans département (premières 10):\n');
        missingDept.slice(0, 10).forEach((c, idx) => {
          console.log(`   ${idx + 1}. ${c.name} (CP: ${c.cp})`);
        });

        if (missingDept.length > 10) {
          console.log(`\n   ... et ${missingDept.length - 10} autres`);
        }
      }
    }

    // Analyse par département
    const deptCounts = {};
    companies.forEach(c => {
      if (c.departement) {
        deptCounts[c.departement] = (deptCounts[c.departement] || 0) + 1;
      }
    });

    console.log('\n\n📊 TOP 10 DÉPARTEMENTS:\n');
    const sorted = Object.entries(deptCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    sorted.forEach(([dept, count], idx) => {
      console.log(`   ${idx + 1}. ${dept}: ${count} companies`);
    });

    console.log('\n' + '=' .repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

main().catch(console.error);
