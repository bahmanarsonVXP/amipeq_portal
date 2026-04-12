#!/usr/bin/env node
const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

function graphql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('/metadata', BASE_URL);
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
      objects {
        edges {
          node {
            id
            nameSingular
            namePlural
            fields {
              edges {
                node {
                  id
                  name
                  label
                  type
                  options
                }
              }
            }
          }
        }
      }
    }
  `;

  console.log('📋 TOUS LES CHAMPS DE L\'OBJET COMPANY\n');
  console.log('=' .repeat(80));

  try {
    const result = await graphql(query);

    // Find company object
    const companyEdge = result.objects.edges.find(edge => edge.node.nameSingular === 'company');
    const company = companyEdge?.node;

    if (!company) {
      console.log('❌ Objet "company" non trouvé');
      return;
    }

    console.log(`\n📦 Objet: ${company.nameSingular}`);
    console.log(`   Nombre de champs: ${company.fields.edges.length}\n`);

    // List all fields
    company.fields.edges.forEach((edge, idx) => {
      const field = edge.node;
      console.log(`${idx + 1}. ${field.name} (${field.label})`);
      console.log(`   Type: ${field.type}`);

      if (field.type === 'SELECT' && field.options) {
        try {
          const options = JSON.parse(field.options);
          if (Array.isArray(options) && options.length > 0) {
            console.log(`   Options: ${options.length} valeurs`);
            // Show first 3 options
            options.slice(0, 3).forEach(opt => {
              console.log(`      - ${opt.value} (${opt.label})`);
            });
            if (options.length > 3) {
              console.log(`      ... et ${options.length - 3} autres`);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      console.log('');
    });

    // Search for department-related fields
    console.log('=' .repeat(80));
    console.log('\n🔍 CHAMPS LIÉS AU DÉPARTEMENT:\n');

    const deptRelated = company.fields.edges.filter(edge => {
      const name = edge.node.name.toLowerCase();
      const label = edge.node.label.toLowerCase();
      return name.includes('depart') || label.includes('départ') || label.includes('depart');
    });

    if (deptRelated.length === 0) {
      console.log('❌ Aucun champ lié au département trouvé !');
      console.log('\n⚠️  PROBLÈME: Les champs "departement" et "departementNumero" n\'existent pas !');
      console.log('   Vous devez d\'abord créer ces champs dans TWENTY avant de pouvoir');
      console.log('   les utiliser dans le workflow.');
    } else {
      deptRelated.forEach(edge => {
        const field = edge.node;
        console.log(`✅ ${field.name} (${field.label})`);
        console.log(`   Type: ${field.type}`);
        console.log(`   ID: ${field.id}`);

        if (field.options) {
          try {
            const options = JSON.parse(field.options);
            console.log(`   Options: ${JSON.stringify(options, null, 2)}`);
          } catch (e) {
            console.log(`   Options (brut): ${field.options}`);
          }
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

main().catch(console.error);
