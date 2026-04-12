#!/usr/bin/env node
/**
 * Audit complet et correction des montants pour toutes les années et tous les statuts
 */

const xlsx = require('xlsx');
const { graphqlRequest, restRequest } = require('./lib/core/http');

const FILE = 'SUIVIS CLIENTS 2026_V2.xlsx';
const SHEETS = ['2023', '2024', '2025', '2026'];
const STATUTS = ['GAGNE', 'PERDU', 'EN_ATTENTE'];

const COL_NUMERO_DEVIS = 7;   // H
const COL_OFFRE1 = 9;         // J
const COL_OFFRE2 = 10;        // K
const COL_STATUT = 24;        // Y

// Mapping statut français → anglais
const STATUT_MAPPING = {
  'Gagné': 'GAGNE',
  'gagné': 'GAGNE',
  'GAGNE': 'GAGNE',
  'Perdu': 'PERDU',
  'perdu': 'PERDU',
  'PERDU': 'PERDU',
  'En attente': 'EN_ATTENTE',
  'en attente': 'EN_ATTENTE',
  'EN_ATTENTE': 'EN_ATTENTE',
  'EN ATTENTE': 'EN_ATTENTE'
};

async function getOpportunitiesFromTwenty(annee, statut) {
  const query = `
    query GetOpportunities($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter, first: 1000) {
        edges {
          node {
            id
            numeroDevis
            amount {
              amountMicros
              currencyCode
            }
            statutDevis
            anneeDevis
          }
        }
      }
    }
  `;

  const result = await graphqlRequest(query, {
    filter: {
      and: [
        { anneeDevis: { eq: annee } },
        { statutDevis: { eq: statut } }
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

  return { count: opportunities.length, index };
}

function getOpportunitiesFromExcel(sheetName, statut) {
  const wb = xlsx.readFile(FILE);
  const ws = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

  const opportunities = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const numeroDevis = row[COL_NUMERO_DEVIS];
    const statutRaw = row[COL_STATUT];
    const statutNormalized = STATUT_MAPPING[String(statutRaw || '').trim()];

    if (numeroDevis && statutNormalized === statut) {
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

  return opportunities;
}

async function fixAmount(opportunityId, numeroDevis, newAmount, dryRun = false) {
  if (dryRun) {
    return { success: true, simulated: true };
  }

  const result = await restRequest('PATCH', `/rest/opportunities/${opportunityId}`, {
    amount: {
      amountMicros: Math.round(newAmount * 1000000),
      currencyCode: 'EUR'
    }
  });

  return {
    success: result.statusCode === 200 || result.statusCode === 201,
    simulated: false
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('📊 AUDIT COMPLET DES MONTANTS\n');
  if (dryRun) {
    console.log('⚠️  MODE DRY-RUN - Aucune correction ne sera appliquée\n');
  }
  console.log('='.repeat(70) + '\n');

  const globalStats = {
    totalOpportunities: 0,
    totalExcel: 0,
    totalTwenty: 0,
    differences: [],
    corrections: []
  };

  const summary = [];

  for (const sheetName of SHEETS) {
    const annee = parseInt(sheetName);

    for (const statut of STATUTS) {
      console.log(`\n📋 ${sheetName} - ${statut}`);
      console.log('-'.repeat(70));

      const excelOpps = getOpportunitiesFromExcel(sheetName, statut);
      const { count: twentyCount, index: twentyIndex } = await getOpportunitiesFromTwenty(annee, statut);

      let totalExcel = 0;
      let totalTwenty = 0;
      let countDifferences = 0;

      for (const excelOpp of excelOpps) {
        totalExcel += excelOpp.montantImport;

        const twentyOpp = twentyIndex.get(excelOpp.numeroDevis);

        if (!twentyOpp) {
          console.log(`  ❌ ${excelOpp.numeroDevis}: MANQUANT dans TWENTY`);
          globalStats.differences.push({
            annee,
            statut,
            numeroDevis: excelOpp.numeroDevis,
            issue: 'missing_in_twenty',
            excelAmount: excelOpp.montantImport,
            twentyAmount: 0
          });
          countDifferences++;
        } else {
          totalTwenty += twentyOpp.amount;

          if (Math.abs(excelOpp.montantImport - twentyOpp.amount) > 0.01) {
            const diff = excelOpp.montantImport - twentyOpp.amount;
            console.log(`  ⚠️  ${excelOpp.numeroDevis}: Excel ${excelOpp.montantImport}€ vs TWENTY ${twentyOpp.amount}€ (écart: ${diff.toFixed(2)}€)`);

            globalStats.differences.push({
              annee,
              statut,
              numeroDevis: excelOpp.numeroDevis,
              issue: 'amount_mismatch',
              excelAmount: excelOpp.montantImport,
              twentyAmount: twentyOpp.amount,
              difference: diff
            });

            // Correction
            const result = await fixAmount(twentyOpp.id, excelOpp.numeroDevis, excelOpp.montantImport, dryRun);
            if (result.success) {
              if (result.simulated) {
                console.log(`    🔄 [SIMULATION] Correction vers ${excelOpp.montantImport}€`);
              } else {
                console.log(`    ✅ Corrigé vers ${excelOpp.montantImport}€`);
                globalStats.corrections.push({
                  annee,
                  statut,
                  numeroDevis: excelOpp.numeroDevis,
                  oldAmount: twentyOpp.amount,
                  newAmount: excelOpp.montantImport
                });
                // Mettre à jour le total TWENTY après correction
                totalTwenty = totalTwenty - twentyOpp.amount + excelOpp.montantImport;
              }
            }
            countDifferences++;
          }
        }
      }

      const ecart = totalExcel - totalTwenty;
      const statusIcon = Math.abs(ecart) < 0.01 ? '✅' : '⚠️';

      console.log(`\n  ${statusIcon} Excel: ${excelOpps.length} opps, ${totalExcel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
      console.log(`  ${statusIcon} TWENTY: ${twentyCount} opps, ${totalTwenty.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
      if (Math.abs(ecart) > 0.01) {
        console.log(`  ⚠️  ÉCART: ${ecart.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € (${countDifferences} différence(s))`);
      }

      summary.push({
        annee: sheetName,
        statut,
        countExcel: excelOpps.length,
        countTwenty: twentyCount,
        totalExcel,
        totalTwenty,
        ecart,
        differences: countDifferences
      });

      globalStats.totalOpportunities += excelOpps.length;
      globalStats.totalExcel += totalExcel;
      globalStats.totalTwenty += totalTwenty;
    }
  }

  // Rapport global
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 RAPPORT GLOBAL\n');

  console.log('Par année et statut:\n');
  const table = {};
  for (const row of summary) {
    if (!table[row.annee]) table[row.annee] = {};
    table[row.annee][row.statut] = {
      count: row.countExcel,
      total: row.totalExcel,
      ecart: row.ecart
    };
  }

  for (const annee of SHEETS) {
    console.log(`\n${annee}:`);
    for (const statut of STATUTS) {
      const data = table[annee][statut];
      if (data) {
        const statusIcon = Math.abs(data.ecart) < 0.01 ? '✅' : '⚠️';
        console.log(`  ${statut.padEnd(15)} ${statusIcon} ${data.count.toString().padStart(3)} opps - ${data.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 }).padStart(12)} €`);
      }
    }
  }

  console.log('\n' + '-'.repeat(70));
  console.log(`\nTotal général Excel:  ${globalStats.totalExcel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
  console.log(`Total général TWENTY: ${globalStats.totalTwenty.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);
  console.log(`Écart total:          ${(globalStats.totalExcel - globalStats.totalTwenty).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`);

  console.log(`\n${globalStats.differences.length} différence(s) trouvée(s)`);
  console.log(`${globalStats.corrections.length} correction(s) appliquée(s)`);

  console.log('\n' + '='.repeat(70));

  // Sauvegarder
  const fs = require('fs');
  fs.writeFileSync('audit_complete.json', JSON.stringify({
    summary,
    globalStats,
    dryRun
  }, null, 2));

  console.log('\n✅ Rapport détaillé sauvegardé dans audit_complete.json');
}

main().catch(console.error);
