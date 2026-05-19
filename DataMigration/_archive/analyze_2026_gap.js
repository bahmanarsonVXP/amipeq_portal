#!/usr/bin/env node
/**
 * Analyser l'écart entre Excel 2026 et TWENTY
 * Excel: 131 opportunités
 * TWENTY: 129 opportunités
 * Manquantes: 2
 */

const xlsx = require('xlsx');
const { graphqlRequest } = require('./lib/core/http');

const FILE = 'SUIVIS CLIENTS 2026_V2.xlsx';
const SHEET = '2026';
const COL_NUMERO_DEVIS = 7;  // H

async function getOpportunitiesFromTwenty() {
  console.log('🔄 Chargement des opportunités 2026 depuis TWENTY...\n');

  const query = `
    query GetOpportunities2026($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter, first: 200) {
        edges {
          node {
            id
            numeroDevis
            anneeDevis
            createdAt
          }
        }
      }
    }
  `;

  const result = await graphqlRequest(query, {
    filter: { anneeDevis: { eq: 2026 } }
  });

  const opportunities = result.opportunities?.edges.map(e => e.node) || [];
  console.log(`✅ ${opportunities.length} opportunités trouvées dans TWENTY avec anneeDevis=2026\n`);

  return opportunities;
}

function getOpportunitiesFromExcel() {
  console.log(`📖 Lecture de l'onglet ${SHEET} dans ${FILE}...\n`);

  const wb = xlsx.readFile(FILE);
  const ws = wb.Sheets[SHEET];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

  const opportunities = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const numeroDevis = row[COL_NUMERO_DEVIS];

    if (numeroDevis) {
      opportunities.push({
        rowIndex: i + 1,
        numeroDevis: String(numeroDevis).trim()
      });
    }
  }

  console.log(`✅ ${opportunities.length} opportunités trouvées dans Excel (onglet ${SHEET})\n`);

  return opportunities;
}

async function main() {
  console.log('🔍 ANALYSE DE L\'ÉCART 2026\n');
  console.log('='.repeat(60) + '\n');

  // Charger les données
  const excelOpps = getOpportunitiesFromExcel();
  const twentyOpps = await getOpportunitiesFromTwenty();

  // Créer des Sets pour comparaison rapide
  const excelNumeros = new Set(excelOpps.map(o => o.numeroDevis));
  const twentyNumeros = new Set(twentyOpps.map(o => o.numeroDevis));

  // Trouver les opportunités manquantes dans TWENTY
  const missingInTwenty = excelOpps.filter(o => !twentyNumeros.has(o.numeroDevis));

  // Trouver les opportunités dans TWENTY mais pas dans Excel
  const extraInTwenty = twentyOpps.filter(o => !excelNumeros.has(o.numeroDevis));

  // Rapport
  console.log('📊 RÉSULTATS\n');
  console.log(`Excel (onglet 2026):           ${excelOpps.length} opportunités`);
  console.log(`TWENTY (anneeDevis=2026):      ${twentyOpps.length} opportunités`);
  console.log(`Écart:                         ${excelOpps.length - twentyOpps.length}\n`);

  if (missingInTwenty.length > 0) {
    console.log(`❌ MANQUANTES DANS TWENTY (${missingInTwenty.length}):\n`);
    missingInTwenty.forEach(o => {
      console.log(`  - ${o.numeroDevis} (Excel ligne ${o.rowIndex})`);
    });
    console.log('');
  }

  if (extraInTwenty.length > 0) {
    console.log(`⚠️  DANS TWENTY MAIS PAS DANS EXCEL (${extraInTwenty.length}):\n`);
    extraInTwenty.forEach(o => {
      console.log(`  - ${o.numeroDevis} (ID: ${o.id})`);
      console.log(`    createdAt: ${o.createdAt}`);
    });
    console.log('');
  }

  if (missingInTwenty.length === 0 && extraInTwenty.length === 0) {
    console.log('✅ Aucune différence trouvée - Excel et TWENTY sont synchronisés\n');
  }

  // Analyse des doublons potentiels dans Excel
  const numeroCounts = {};
  excelOpps.forEach(o => {
    numeroCounts[o.numeroDevis] = (numeroCounts[o.numeroDevis] || 0) + 1;
  });

  const duplicatesInExcel = Object.entries(numeroCounts).filter(([_, count]) => count > 1);

  if (duplicatesInExcel.length > 0) {
    console.log(`🔄 DOUBLONS DANS EXCEL (${duplicatesInExcel.length}):\n`);
    duplicatesInExcel.forEach(([numero, count]) => {
      console.log(`  - ${numero} : ${count} fois`);
      const rows = excelOpps.filter(o => o.numeroDevis === numero).map(o => o.rowIndex);
      console.log(`    Lignes: ${rows.join(', ')}`);
    });
    console.log('');
  }

  console.log('='.repeat(60));
}

main().catch(console.error);
