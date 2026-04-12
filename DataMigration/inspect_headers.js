#!/usr/bin/env node
/**
 * Inspecter les en-têtes du fichier Excel pour trouver la colonne "Statut pour l'import"
 */

const xlsx = require('xlsx');

const FILE = 'SUIVISCLIENTS_2026_V2.xlsx';
const SHEET = '2026';  // Commençons par 2026

console.log(`📖 Inspection des en-têtes de l'onglet ${SHEET}...\n`);

const wb = xlsx.readFile(FILE);
const ws = wb.Sheets[SHEET];
const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

if (data.length === 0) {
  console.log('❌ Fichier vide');
  process.exit(1);
}

const headers = data[0];
console.log('📋 EN-TÊTES (première ligne):\n');

headers.forEach((header, index) => {
  const letter = String.fromCharCode(65 + index); // A=65
  const displayHeader = header || '(vide)';
  console.log(`  Colonne ${letter} (index ${index}): ${displayHeader}`);
});

console.log('\n🔍 RECHERCHE "Statut"...\n');

const statutColumns = headers
  .map((h, idx) => ({ header: h, index: idx, letter: String.fromCharCode(65 + idx) }))
  .filter(col => col.header && String(col.header).toLowerCase().includes('statut'));

if (statutColumns.length > 0) {
  statutColumns.forEach(col => {
    console.log(`  ✓ Trouvé: "${col.header}" en colonne ${col.letter} (index ${col.index})`);
  });
} else {
  console.log('  ❌ Aucune colonne contenant "statut" trouvée');
}

console.log('\n📊 EXEMPLE DE DONNÉES (5 premières lignes):\n');

for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
  console.log(`Ligne ${i}:`);
  const row = data[i];

  // Afficher quelques colonnes clés
  const colsToShow = [7, 8, 23, 24, 25];  // H, I, X, Y, Z
  colsToShow.forEach(idx => {
    const letter = String.fromCharCode(65 + idx);
    const header = headers[idx] || '?';
    const value = row[idx] || '(vide)';
    console.log(`  ${letter} (${header}): ${value}`);
  });
  console.log('');
}
