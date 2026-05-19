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
                  defaultValue
                }
              }
            }
          }
        }
      }
    }
  `;

  console.log('🔍 VÉRIFICATION DU CHAMP "DÉPARTEMENT"\n');
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

    console.log(`\n📦 Objet: ${company.nameSingular} (${company.namePlural})`);
    console.log(`   ID: ${company.id}`);

    // Filter for departement fields
    const departementFields = company.fields.edges.filter(edge =>
      edge.node.name === 'departement' || edge.node.name === 'departementNumero'
    );

    departementFields.forEach(edge => {
      const field = edge.node;
      console.log(`\n📋 Champ: ${field.name}`);
      console.log(`   Label: ${field.label}`);
      console.log(`   Type: ${field.type}`);
      console.log(`   ID: ${field.id}`);

      if (field.options) {
        try {
          const options = JSON.parse(field.options);
          console.log(`\n   Options configurées (${options.length || 0}):`);

          if (Array.isArray(options)) {
            // Show first 10 options
            const toShow = options.slice(0, 10);
            toShow.forEach((opt, idx) => {
              console.log(`   ${idx + 1}. ${JSON.stringify(opt)}`);
            });

            if (options.length > 10) {
              console.log(`   ... et ${options.length - 10} autres options`);
            }

            // Check specifically for dept 12, 13, 48
            console.log(`\n   🔍 Vérification des départements testés:`);
            const dept12 = options.find(o => o.value === 'DEPT_12_AVEYRON');
            const dept13 = options.find(o => o.value === 'DEPT_13_BOUCHES_DU_RHONE');
            const dept48 = options.find(o => o.value === 'DEPT_48_LOZERE');

            console.log(`   12 - Aveyron: ${dept12 ? '✅ ' + JSON.stringify(dept12) : '❌ NON TROUVÉ'}`);
            console.log(`   13 - Bouches-du-Rhône: ${dept13 ? '✅ ' + JSON.stringify(dept13) : '❌ NON TROUVÉ'}`);
            console.log(`   48 - Lozère: ${dept48 ? '✅ ' + JSON.stringify(dept48) : '❌ NON TROUVÉ'}`);

            // List all configured values
            console.log(`\n   📝 TOUTES les valeurs configurées:`);
            options.forEach(opt => {
              console.log(`      ${opt.value} → ${opt.label}`);
            });
          } else {
            console.log(`   Format inattendu: ${JSON.stringify(options)}`);
          }
        } catch (e) {
          console.log(`   Options (brut): ${field.options}`);
        }
      } else {
        console.log(`   ⚠️  Pas d'options configurées`);
      }
    });

    console.log('\n' + '=' .repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

main().catch(console.error);
