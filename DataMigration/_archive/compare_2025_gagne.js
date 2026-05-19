#!/usr/bin/env node
/**
 * Comparaison détaillée des opportunités gagnées 2025 : Excel vs TWENTY
 */

const xlsx = require('xlsx');
const { graphqlRequest } = require('./lib/core/http');

const FILE = 'SUIVIS CLIENTS 2026_V2.xlsx';
const SHEET = '2025';

const COL_NUMERO_DEVIS = 7;   // H
const COL_NOM = 3;            // D
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
    query GetWonOpportunities2025($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter, first: 500) {
        edges {
          node {
            id
            numeroDevis
            name
            amount {
              amountMicros
              currencyCode
            }
            statutDevis
            anneeDevis
            createdAt
            company {
              name
            }
          }
        }
      }
    }
  `;

  const result = await graphqlRequest(query, {
    filter: {
      and: [
        { anneeDevis: { eq: 2025 } },
        { statutDevis: { eq: 'GAGNE' } }
      ]
    }
  });

  const opportunities = result.opportunities?.edges.map(e => e.node) || [];

  console.log(`✅ ${opportunities.length} opportunités gagnées dans TWENTY\n`);

  // Créer un index par numeroDevis
  const index = new Map();
  opportunities.forEach(opp => {
    if (opp.numeroDevis) {
      index.set(opp.numeroDevis, {
        id: opp.id,
        name: opp.name,
        amount: opp.amount ? opp.amount.amountMicros / 1000000 : 0,
        company: opp.company?.name,
        createdAt: opp.createdAt
      });
    }
  });

  return { opportunities, index };
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
    const statut = STATUT_MAPPING[String(statutRaw || '').trim()];

    if (numeroDevis && statut === 'GAGNE') {
      const offre1 = row[COL_OFFRE1] ? Number(row[COL_OFFRE1]) : 0;
      const offre2 = row[COL_OFFRE2] ? Number(row[COL_OFFRE2]) : 0;
      const montantImport = offre2 || offre1;

      opportunities.push({
        rowIndex: i + 1,
        numeroDevis: String(numeroDevis).trim(),
        nom: row[COL_NOM],
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
  console.log('🔍 COMPARAISON 2025 - OPPORTUNITÉS GAGNÉES\n');
  console.log('='.repeat(70) + '\n');

  const excelOpps = getOpportunitiesFromExcel();
  const { opportunities: twentyOpps, index: twentyIndex } = await getOpportunitiesFromTwenty();

  // Créer des Sets pour comparaison
  const excelNumeros = new Set(excelOpps.map(o => o.numeroDevis));
  const twentyNumeros = new Set(twentyOpps.map(o => o.numeroDevis));

  // Trouver les différences
  const onlyInExcel = excelOpps.filter(o => !twentyNumeros.has(o.numeroDevis));
  const onlyInTwenty = twentyOpps.filter(o => !excelNumeros.has(o.numeroDevis));

  console.log('📊 STATISTIQUES:\n');
  console.log(`Excel:  ${excelOpps.length} opportunités`);
  console.log(`TWENTY: ${twentyOpps.length} opportunités`);
  console.log(`Écart:  ${twentyOpps.length - excelOpps.length} opportunité(s)`);
  console.log('');

  if (onlyInExcel.length > 0) {
    console.log(`\n❌ DANS EXCEL MAIS PAS DANS TWENTY (${onlyInExcel.length}):\n`);
    onlyInExcel.forEach(opp => {
      console.log(`  ${opp.numeroDevis} (ligne ${opp.rowIndex})`);
      console.log(`    Société: ${opp.nom}`);
      console.log(`    Montant: ${opp.montantImport} €`);
      console.log('');
    });
  }

  if (onlyInTwenty.length > 0) {
    console.log(`\n⚠️  DANS TWENTY MAIS PAS DANS EXCEL (${onlyInTwenty.length}):\n`);
    onlyInTwenty.forEach(opp => {
      console.log(`  ${opp.numeroDevis}`);
      console.log(`    Société: ${opp.company}`);
      console.log(`    Montant: ${opp.amount} €`);
      console.log(`    Créé le: ${opp.createdAt}`);
      console.log(`    ID: ${opp.id}`);
      console.log('');
    });
  }

  // Vérifier les doublons dans Excel
  const numeroCounts = {};
  excelOpps.forEach(o => {
    numeroCounts[o.numeroDevis] = (numeroCounts[o.numeroDevis] || 0) + 1;
  });

  const duplicatesInExcel = Object.entries(numeroCounts).filter(([_, count]) => count > 1);

  if (duplicatesInExcel.length > 0) {
    console.log(`\n🔄 DOUBLONS DANS EXCEL (${duplicatesInExcel.length}):\n`);
    duplicatesInExcel.forEach(([numero, count]) => {
      console.log(`  ${numero} : ${count} fois`);
      const rows = excelOpps.filter(o => o.numeroDevis === numero).map(o => o.rowIndex);
      console.log(`    Lignes: ${rows.join(', ')}`);
      console.log('');
    });
  }

  // Calcul des totaux
  const totalExcel = excelOpps.reduce((sum, o) => sum + o.montantImport, 0);
  const totalTwenty = twentyOpps.reduce((sum, o) => sum + (o.amount ? o.amount.amountMicros / 1000000 : 0), 0);

  console.log('\n' + '='.repeat(70));
  console.log('💰 MONTANTS TOTAUX:\n');
  console.log(`Excel:  ${totalExcel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
  console.log(`TWENTY: ${totalTwenty.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
  console.log(`Écart:  ${(totalTwenty - totalExcel).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
  console.log('='.repeat(70));

  // Sauvegarder
  const fs = require('fs');
  fs.writeFileSync('comparison_2025_gagne.json', JSON.stringify({
    excel: {
      count: excelOpps.length,
      total: totalExcel,
      opportunities: excelOpps
    },
    twenty: {
      count: twentyOpps.length,
      total: totalTwenty,
      opportunities: twentyOpps.map(o => ({
        numeroDevis: o.numeroDevis,
        company: o.company,
        amount: o.amount ? o.amount.amountMicros / 1000000 : 0,
        createdAt: o.createdAt,
        id: o.id
      }))
    },
    onlyInExcel,
    onlyInTwenty: onlyInTwenty.map(o => ({
      numeroDevis: o.numeroDevis,
      company: o.company,
      amount: o.amount ? o.amount.amountMicros / 1000000 : 0,
      createdAt: o.createdAt,
      id: o.id
    })),
    duplicatesInExcel
  }, null, 2));

  console.log('\n✅ Détails sauvegardés dans comparison_2025_gagne.json');
}

main().catch(console.error);
