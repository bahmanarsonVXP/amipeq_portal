#!/usr/bin/env node
const https = require('https');
const xlsx = require('xlsx');
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

async function checkOpportunity(numeroDevis) {
  const query = `
    query GetOpportunities($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter) {
        edges {
          node {
            id
            name
            numeroDevis
            amount {
              amountMicros
              currencyCode
            }
            montantRemise {
              amountMicros
              currencyCode
            }
            tauxRemise
            company {
              name
              numeroSociete
            }
          }
        }
      }
    }
  `;

  const result = await graphql(query, { filter: { numeroDevis: { eq: numeroDevis } } });
  return result.opportunities.edges[0]?.node;
}

function readExcelForOpportunity(numeroDevis) {
  const workbook = xlsx.readFile('SUIVIS CLIENTS 2026.xlsx');
  const allRows = [];

  ['2023', '2024', '2025', '2026'].forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    rows.forEach((row, idx) => {
      if (idx === 0) return; // Skip header
      const devis = row[7]; // Column H = Numéro devis
      if (devis === numeroDevis) {
        allRows.push({
          sheet: sheetName,
          row: idx + 1,
          numeroDevis: row[7],
          offre1: row[9],
          offre2: row[10],
          norme: row[11]
        });
      }
    });
  });

  return allRows;
}

async function main() {
  const numeroDevis = process.argv[2] || '108873-CL-25387';

  console.log(`🔍 VÉRIFICATION DE L'OPPORTUNITY: ${numeroDevis}\n`);
  console.log('=' .repeat(80));

  // 1. Vérifier dans TWENTY
  console.log('\n📦 Dans TWENTY:\n');
  try {
    const opp = await checkOpportunity(numeroDevis);

    if (!opp) {
      console.log(`   ❌ Opportunity "${numeroDevis}" non trouvée dans TWENTY`);
    } else {
      console.log(`   ✅ Trouvée: ${opp.name}`);
      console.log(`   Company: ${opp.company?.name} (${opp.company?.numeroSociete})`);
      console.log(`   Amount: ${opp.amount ? `${opp.amount.amountMicros / 1000000} ${opp.amount.currencyCode}` : '❌ NULL'}`);
      console.log(`   Montant Remise: ${opp.montantRemise ? `${opp.montantRemise.amountMicros / 1000000} ${opp.montantRemise.currencyCode}` : '❌ NULL'}`);
      console.log(`   Taux Remise: ${opp.tauxRemise !== null && opp.tauxRemise !== undefined ? `${opp.tauxRemise}%` : '❌ NULL'}`);
    }
  } catch (error) {
    console.error(`   ❌ Erreur:`, error.message);
  }

  // 2. Vérifier dans Excel
  console.log('\n\n📄 Dans Excel:\n');
  const excelRows = readExcelForOpportunity(numeroDevis);

  if (excelRows.length === 0) {
    console.log(`   ❌ Opportunity "${numeroDevis}" non trouvée dans Excel`);
  } else {
    excelRows.forEach(data => {
      console.log(`   ✅ Trouvée dans l'onglet ${data.sheet}, ligne ${data.row}`);
      console.log(`   Numéro Devis: ${data.numeroDevis}`);
      console.log(`   OFFRE N° 1 (col J): ${data.offre1 || '❌ VIDE'}`);
      console.log(`   OFFRE N° 2 (col K): ${data.offre2 || '❌ VIDE'}`);
      console.log(`   NORME (col L): ${data.norme || '❌ VIDE'}`);

      // Calculer ce qui devrait être importé
      const offre1 = Number(data.offre1);
      const offre2 = Number(data.offre2);

      console.log(`\n   💡 Valeurs attendues dans TWENTY:`);

      if (offre2 > 0) {
        console.log(`      Amount: ${offre2} EUR`);
      } else if (offre1 > 0) {
        console.log(`      Amount: ${offre1} EUR`);
      } else {
        console.log(`      Amount: ❌ Aucune valeur (offre1 et offre2 vides)`);
      }

      if (offre1 > 0 && offre2 > 0) {
        const tauxRemise = Math.round((1 - offre2 / offre1) * 100);
        const montantRemise = offre1 - offre2;
        console.log(`      Montant Remise: ${montantRemise} EUR`);
        console.log(`      Taux Remise: ${tauxRemise}%`);
      } else {
        console.log(`      Montant Remise: ❌ Non calculable (il faut offre1 ET offre2)`);
        console.log(`      Taux Remise: ❌ Non calculable`);
      }
    });
  }

  console.log('\n' + '=' .repeat(80));
}

main().catch(console.error);
