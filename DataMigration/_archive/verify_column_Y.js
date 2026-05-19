#!/usr/bin/env node
/**
 * Script de vérification de la colonne Y (statut pour import)
 * Vérifie que les données existent avant d'exécuter la mise à jour
 */

const xlsx = require('xlsx');

const FILE = 'SUIVIS CLIENTS 2026_V2.xlsx';  // Avec espace !

// Mapping français → constantes TWENTY
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
const SHEETS = ['2023', '2024', '2025', '2026'];
const COL_NUMERO_DEVIS = 7;   // Colonne H
const COL_STATUT = 24;         // Colonne Y

console.log(`📖 Vérification de la colonne Y dans ${FILE}...\n`);

const wb = xlsx.readFile(FILE);

const summary = {
  totalRows: 0,
  withStatut: 0,
  byStatut: {},
  bySheet: {}
};

for (const sheetName of SHEETS) {
  if (!wb.SheetNames.includes(sheetName)) {
    console.log(`⚠️  Onglet ${sheetName} non trouvé`);
    continue;
  }

  const ws = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

  summary.bySheet[sheetName] = {
    totalRows: data.length - 1,
    withStatut: 0,
    byStatut: {}
  };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const numeroDevis = row[COL_NUMERO_DEVIS];
    const statutPourImport = row[COL_STATUT];

    summary.totalRows++;

    if (numeroDevis && statutPourImport) {
      const statutOriginal = String(statutPourImport).trim();
      const statut = STATUT_MAPPING[statutOriginal] || statutOriginal;

      summary.withStatut++;
      summary.byStatut[statut] = (summary.byStatut[statut] || 0) + 1;

      summary.bySheet[sheetName].withStatut++;
      summary.bySheet[sheetName].byStatut[statut] = (summary.bySheet[sheetName].byStatut[statut] || 0) + 1;
    }
  }
}

// Affichage des résultats
console.log('📊 RÉSUMÉ GLOBAL\n');
console.log(`Total de lignes:           ${summary.totalRows}`);
console.log(`Lignes avec statut:        ${summary.withStatut}`);
console.log(`Lignes sans statut:        ${summary.totalRows - summary.withStatut}`);
console.log(`Couverture:                ${Math.round(summary.withStatut / summary.totalRows * 100)}%\n`);

console.log('📋 RÉPARTITION PAR STATUT\n');
const sortedStatuts = Object.entries(summary.byStatut).sort((a, b) => b[1] - a[1]);
for (const [statut, count] of sortedStatuts) {
  const pct = Math.round(count / summary.withStatut * 100);
  console.log(`  ${statut.padEnd(15)} ${count.toString().padStart(4)} (${pct}%)`);
}

console.log('\n📑 DÉTAIL PAR ONGLET\n');
for (const sheetName of SHEETS) {
  const sheet = summary.bySheet[sheetName];
  if (!sheet) continue;

  console.log(`${sheetName}:`);
  console.log(`  Total: ${sheet.totalRows}, Avec statut: ${sheet.withStatut}`);

  const sheetStatuts = Object.entries(sheet.byStatut).sort((a, b) => b[1] - a[1]);
  for (const [statut, count] of sheetStatuts) {
    console.log(`    ${statut}: ${count}`);
  }
  console.log('');
}

// Vérification de la validité des statuts
const VALID_STATUTS = ['GAGNE', 'PERDU', 'EN_ATTENTE'];
const invalidStatuts = Object.keys(summary.byStatut).filter(s => !VALID_STATUTS.includes(s));

if (invalidStatuts.length > 0) {
  console.log('⚠️  ATTENTION: Statuts invalides détectés:\n');
  for (const statut of invalidStatuts) {
    console.log(`  "${statut}" (${summary.byStatut[statut]} occurrences)`);
  }
  console.log('\nStatuts valides: ' + VALID_STATUTS.join(', '));
  console.log('\n⚠️  Ces lignes seront ignorées lors de la mise à jour\n');
}

console.log('✅ Vérification terminée');
