#!/usr/bin/env node
/**
 * Inspecter TOUTES les colonnes du fichier Excel pour trouver "Statut pour l'import"
 */

const xlsx = require('xlsx');

const FILE = 'SUIVISCLIENTS_2026_V2.xlsx';
const SHEETS = ['2023', '2024', '2025', '2026'];

console.log(`📖 Inspection complète du fichier ${FILE}...\n`);

for (const sheetName of SHEETS) {
  const wb = xlsx.readFile(FILE);
  const ws = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

  if (data.length === 0) continue;

  const headers = data[0];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ONGLET: ${sheetName}`);
  console.log(`${'='.repeat(60)}\n`);

  console.log(`Nombre total de colonnes: ${headers.length}\n`);

  // Afficher toutes les colonnes
  console.log('TOUTES LES COLONNES:\n');
  headers.forEach((header, index) => {
    const letter = index < 26
      ? String.fromCharCode(65 + index)
      : String.fromCharCode(65 + Math.floor(index / 26) - 1) + String.fromCharCode(65 + (index % 26));

    const displayHeader = header ? String(header) : '(vide)';
    console.log(`  ${letter.padEnd(3)} (index ${String(index).padStart(2)}): ${displayHeader}`);
  });

  // Recherche de "statut"
  console.log('\n🔍 COLONNES CONTENANT "STATUT":\n');
  const statutColumns = headers
    .map((h, idx) => ({ header: h, index: idx }))
    .filter(col => col.header && String(col.header).toLowerCase().includes('statut'));

  if (statutColumns.length > 0) {
    statutColumns.forEach(col => {
      console.log(`  ✓ "${col.header}" à l'index ${col.index}`);

      // Afficher quelques exemples de valeurs
      console.log(`    Exemples de valeurs:`);
      for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
        const value = data[i][col.index];
        if (value) {
          console.log(`      Ligne ${i}: ${value}`);
        }
      }
    });
  } else {
    console.log('  ❌ Aucune colonne trouvée');
  }
}

console.log('\n' + '='.repeat(60));
