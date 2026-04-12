#!/usr/bin/env node
/**
 * Comparer les montants Excel vs TWENTY pour les opportunités gagnées 2026
 */

const xlsx = require('xlsx');
const { graphqlRequest } = require('./lib/core/http');

const FILE = 'SUIVIS CLIENTS 2026_V2.xlsx';
const SHEET = '2026';

const COL_NUMERO_DEVIS = 7;   // H
const COL_OFFRE1 = 9;         // J
const COL_OFFRE2 = 10;        // K
const COL_STATUT = 24;        // Y

// Mapping statut français → anglais
const STATUT_MAPPING = {
  'Gagné': 'GAGNE',
  'gagné': 'GAGNE',
  'GAGNE': 'GAGNE'
};

async function getOpportunitiesFromTwenty() {
  console.log('🔄 Chargement depuis TWENTY...\n');

  const query = `
    query GetWonOpportunities2026($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter, first: 200) {
        edges {
          node {
            id
            numeroDevis
            amount {
              amountMicros
              currencyCode
            }
            statutDevis
          }
        }
      }
    }
  `;

  const result = await graphqlRequest(query, {
    filter: {
      and: [
        { anneeDevis: { eq: 2026 } },
        { statutDevis: { eq: 'GAGNE' } }
      ]
    }
  });

  const opportunities = result.opportunities?.edges.map(e => e.node) || [];

  // Créer un index par numeroDevis
  const index = new Map();
  opportunities.forEach(opp => {
    if (opp.numeroDevis) {
      index.set(opp.numeroDevis, {
        id: opp.id,
        amount: opp.amount ? opp.amount.amountMicros / 1000000 : 0
      });
    }
  });

  console.log(`✅ ${opportunities.length} opportunités gagnées dans TWENTY\n`);
  return index;
}

function getOpportunitiesFromExcel() {
  console.log('📖 Lecture depuis Excel...\n');

  const wb = xlsx.readFile(FILE);
  const ws = wb.Sheets[SHEET];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

  const opportunities = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const numeroDevis = row[COL_NUMERO_DEVIS];
    const statutRaw = row[COL_STATUT];
    const statut = STATUT_MAPPING[String(statutRaw).trim()];

    if (numeroDevis && statut === 'GAGNE') {
      const offre1 = row[COL_OFFRE1] ? Number(row[COL_OFFRE1]) : 0;
      const offre2 = row[COL_OFFRE2] ? Number(row[COL_OFFRE2]) : 0;

      // Logique d'import : offre2 en priorité, sinon offre1
      const montantImport = offre2 || offre1;

      opportunities.push({
        rowIndex: i + 1,
        numeroDevis: String(numeroDevis).trim(),
        offre1,
        offre2,
        montantImport
      });
    }
  }

  console.log(`✅ ${opportunities.length} opportunités gagnées dans Excel\n`);
  return opportunities;
}

async function main() {
  console.log('🔍 COMPARAISON EXCEL vs TWENTY - OPPORTUNITÉS GAGNÉES 2026\n');
  console.log('='.repeat(60) + '\n');

  const excelOpps = getOpportunitiesFromExcel();
  const twentyIndex = await getOpportunitiesFromTwenty();

  let totalExcel = 0;
  let totalTwenty = 0;
  const differences = [];

  console.log('📊 COMPARAISON DÉTAILLÉE:\n');

  for (const excelOpp of excelOpps) {
    const twentyOpp = twentyIndex.get(excelOpp.numeroDevis);

    totalExcel += excelOpp.montantImport;

    if (!twentyOpp) {
      console.log(`❌ ${excelOpp.numeroDevis}: MANQUANT dans TWENTY`);
      console.log(`   Excel: ${excelOpp.montantImport} € (offre1: ${excelOpp.offre1}, offre2: ${excelOpp.offre2})`);
      differences.push({
        numeroDevis: excelOpp.numeroDevis,
        issue: 'missing_in_twenty',
        excelAmount: excelOpp.montantImport,
        twentyAmount: 0
      });
    } else {
      totalTwenty += twentyOpp.amount;

      if (Math.abs(excelOpp.montantImport - twentyOpp.amount) > 0.01) {
        console.log(`⚠️  ${excelOpp.numeroDevis}: MONTANT DIFFÉRENT`);
        console.log(`   Excel: ${excelOpp.montantImport} € (offre1: ${excelOpp.offre1}, offre2: ${excelOpp.offre2})`);
        console.log(`   TWENTY: ${twentyOpp.amount} €`);
        console.log(`   Écart: ${(excelOpp.montantImport - twentyOpp.amount).toFixed(2)} €`);
        console.log('');
        differences.push({
          numeroDevis: excelOpp.numeroDevis,
          issue: 'amount_mismatch',
          excelAmount: excelOpp.montantImport,
          twentyAmount: twentyOpp.amount,
          difference: excelOpp.montantImport - twentyOpp.amount
        });
      }
    }
  }

  // Chercher les opportunités dans TWENTY mais pas dans Excel
  for (const [numeroDevis, twentyOpp] of twentyIndex.entries()) {
    const existsInExcel = excelOpps.some(e => e.numeroDevis === numeroDevis);
    if (!existsInExcel) {
      console.log(`⚠️  ${numeroDevis}: Dans TWENTY mais PAS dans Excel (gagnées)`);
      console.log(`   TWENTY: ${twentyOpp.amount} €`);
      console.log('');
      differences.push({
        numeroDevis,
        issue: 'in_twenty_not_excel',
        excelAmount: 0,
        twentyAmount: twentyOpp.amount
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('💰 TOTAUX\n');
  console.log(`Excel:  ${totalExcel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
  console.log(`TWENTY: ${totalTwenty.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
  console.log(`ÉCART:  ${(totalExcel - totalTwenty).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
  console.log('='.repeat(60));

  if (differences.length > 0) {
    console.log(`\n⚠️  ${differences.length} différence(s) trouvée(s)`);
  } else {
    console.log('\n✅ Aucune différence - Parfaitement synchronisé');
  }

  // Sauvegarder
  const fs = require('fs');
  fs.writeFileSync('comparison_2026.json', JSON.stringify({
    totalExcel,
    totalTwenty,
    difference: totalExcel - totalTwenty,
    differences
  }, null, 2));

  console.log('\n✅ Détails sauvegardés dans comparison_2026.json');
}

main().catch(console.error);
