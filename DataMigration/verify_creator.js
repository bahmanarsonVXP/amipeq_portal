#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

function gql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('/metadata', BASE_URL);
    const data = JSON.stringify({ query, variables });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const mappings = JSON.parse(fs.readFileSync('mappings.json', 'utf-8'));
  const firstCompanyId = Object.values(mappings.companies)[0];

  console.log('🔍 Vérification du champ "Créé par"...\n');
  console.log('ID de la company:', firstCompanyId);

  const query = `
    query GetCompany($id: UUID!) {
      companies(filter: { id: { eq: $id } }) {
        edges {
          node {
            id
            name
            createdBy {
              source
              name
              workspaceMemberId
            }
            createdAt
          }
        }
      }
    }
  `;

  const result = await gql(query, { id: firstCompanyId });

  if (result.errors) {
    console.error('❌ Erreur:', JSON.stringify(result.errors, null, 2));
    return;
  }

  const company = result.data?.companies?.edges[0]?.node;
  if (company) {
    console.log('\n📦 Company:', company.name);
    console.log('   Créé le:', company.createdAt);
    console.log('   Créé par:', JSON.stringify(company.createdBy, null, 2));

    if (company.createdBy.name === 'Alexandra') {
      console.log('\n✅ SUCCESS - "Alexandra" est bien enregistré comme créateur !');
    } else {
      console.log('\n⚠️  Le créateur est:', company.createdBy.name);
      console.log('   (Attendu: "Alexandra")');
    }
  }
}

main().catch(console.error);
