#!/usr/bin/env node
const https = require('https');
const xlsx = require('xlsx');
const fs = require('fs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

function restRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔍 TEST IMPORT D\'UNE SEULE OPPORTUNITY\n');
  console.log('=' .repeat(80));

  // Lire Excel
  const workbook = xlsx.readFile('SUIVIS CLIENTS 2026.xlsx', { cellStyles: true });
  const sheet = workbook.Sheets['2025'];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });

  // Ligne 385 (108873-CL-25387)
  const i = 384;
  const row = data[i];

  const oppData = {
    annee: '2025',
    prosp: row[0] || '',
    date: row[1] || '',
    numeroSociete: String(Math.floor(Number(row[2]))),
    client: row[3] || '',
    titre: row[4] || '',
    contact: row[5] || '',
    cial: row[6] || '',
    numeroDevis: row[7] || '',
    dateDevis: row[8] || '',
    offre1: row[9] || '',
    offre2: row[10] || '',
    norme: row[11] || '',
  };

  console.log('\n📋 Données lues depuis Excel:\n');
  console.log(`  numeroDevis: ${oppData.numeroDevis}`);
  console.log(`  offre1: ${oppData.offre1} (type: ${typeof oppData.offre1})`);
  console.log(`  offre2: ${oppData.offre2} (type: ${typeof oppData.offre2})`);

  // Calcul comme dans l'import
  let tauxRemise = null;
  let montantRemise = null;

  console.log(`\n🔢 Calcul:`);
  console.log(`  if (oppData.offre1 && oppData.offre2) = ${!!(oppData.offre1 && oppData.offre2)}`);

  if (oppData.offre1 && oppData.offre2) {
    const o1 = Number(oppData.offre1);
    const o2 = Number(oppData.offre2);
    console.log(`  o1 = ${o1}, o2 = ${o2}`);
    if (o1 > 0 && o2 > 0) {
      tauxRemise = Math.round((1 - o2 / o1) * 100);
      montantRemise = {
        amountMicros: Math.round((o1 - o2) * 1000000),
        currencyCode: 'EUR'
      };
      console.log(`  ✅ tauxRemise = ${tauxRemise}%, montantRemise = ${o1 - o2} EUR`);
    }
  } else {
    console.log(`  ❌ Condition FALSE!`);
  }

  const montantPrincipal = oppData.offre2 || oppData.offre1;
  console.log(`  montantPrincipal = ${montantPrincipal}`);

  // Récupérer companyId depuis mappings
  const mappings = JSON.parse(fs.readFileSync('mappings.json', 'utf-8'));
  const companyId = mappings.companies[oppData.numeroSociete];

  if (!companyId) {
    console.log(`\n❌ Company ${oppData.numeroSociete} non trouvée dans mappings`);
    return;
  }

  const body = {
    name: oppData.numeroDevis,
    companyId,
    amount: montantPrincipal ? {
      amountMicros: Math.round(Number(montantPrincipal) * 1000000),
      currencyCode: 'EUR'
    } : null,
    montantRemise,
    tauxRemise,
    stage: 'DEVIS_ENVOYE',
    numeroDevis: oppData.numeroDevis
  };

  console.log(`\n📤 Body à envoyer:`);
  console.log(JSON.stringify(body, null, 2));

  console.log(`\n🚀 Création de l'opportunity...\n`);

  const result = await restRequest('POST', '/rest/opportunities', body);

  console.log(`Status: ${result.statusCode}`);
  if (result.statusCode === 201 || result.statusCode === 200) {
    const id = result.data.data?.createOpportunity?.id;
    console.log(`✅ Créée avec ID: ${id}`);
    console.log(`\n📊 Données enregistrées:`);
    const opp = result.data.data.createOpportunity;
    console.log(`  Amount: ${opp.amount ? `${opp.amount.amountMicros / 1000000} EUR` : 'NULL'}`);
    console.log(`  Montant Remise: ${opp.montantRemise ? `${opp.montantRemise.amountMicros / 1000000} EUR` : 'NULL'}`);
    console.log(`  Taux Remise: ${opp.tauxRemise ?? 'NULL'}%`);
  } else {
    console.log(`❌ Échec:`);
    console.log(JSON.stringify(result.data, null, 2));
  }

  console.log('\n' + '=' .repeat(80));
}

main().catch(console.error);
