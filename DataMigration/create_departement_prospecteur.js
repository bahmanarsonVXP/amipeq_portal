#!/usr/bin/env node
const https = require('https');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

const COMPANY_ID = 'd7fd7751-b173-4f12-afe9-d783c3170863';

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
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createField(field) {
  const mutation = `
    mutation CreateField($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) {
        id name label type
      }
    }
  `;

  const input = { field };
  const result = await gql(mutation, { input });

  if (result.errors) {
    throw new Error(JSON.stringify(result.errors, null, 2));
  }

  return result.data.createOneField;
}

async function main() {
  console.log('📝 Création des champs departementNumero et prospecteur...\n');

  try {
    const deptNum = await createField({
      name: 'departementNumero',
      label: 'N° Département',
      type: 'TEXT',
      objectMetadataId: COMPANY_ID,
      description: 'Numéro brut du département (ex: "13", "971")',
      isNullable: true,
    });
    console.log('  ✅ departementNumero —', deptNum.id);
  } catch (err) {
    console.error('  ❌ departementNumero —', err.message);
  }

  await sleep(300);

  try {
    const prosp = await createField({
      name: 'prospecteur',
      label: 'Prospecteur',
      type: 'SELECT',
      objectMetadataId: COMPANY_ID,
      description: 'Commercial ayant prospecté le client',
      isNullable: true,
      options: [
        { value: 'ALEX', label: 'ALEX', color: 'blue', position: 0 },
        { value: 'CL', label: 'CL', color: 'green', position: 1 }
      ]
    });
    console.log('  ✅ prospecteur —', prosp.id);
  } catch (err) {
    console.error('  ❌ prospecteur —', err.message);
  }

  console.log('\n✅ Terminé !');
}

main().catch(console.error);
