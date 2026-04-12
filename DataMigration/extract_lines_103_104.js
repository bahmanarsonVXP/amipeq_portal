#!/usr/bin/env node
/**
 * Extraire les données des lignes 103 et 104 de l'onglet 2026
 */

const xlsx = require('xlsx');
const fs = require('fs');

const FILE = 'SUIVIS CLIENTS 2026_V2.xlsx';
const SHEET = '2026';
const TARGET_LINES = [103, 104];  // Lignes Excel (row index)

const COL_NUMERO_SOCIETE = 2;   // C
const COL_NOM = 3;              // D
const COL_CONTACT = 5;          // F
const COL_EMAIL = 22;           // W
const COL_NUMERO_DEVIS = 7;     // H
const COL_DATE_DEVIS = 8;       // I
const COL_OFFRE1 = 9;           // J
const COL_OFFRE2 = 10;          // K
const COL_NORME = 11;           // L
const COL_CP = 18;              // S
const COL_VILLE = 19;           // T
const COL_TELEPHONE = 20;       // U
const COL_STATUT = 24;          // Y

console.log(`📖 Extraction des lignes ${TARGET_LINES.join(', ')} de l'onglet ${SHEET}...\n`);

const wb = xlsx.readFile(FILE, { cellStyles: true });
const ws = wb.Sheets[SHEET];
const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

const extracted = [];

for (const lineNumber of TARGET_LINES) {
  const i = lineNumber - 1;  // Convert to 0-indexed

  if (i >= data.length) {
    console.log(`⚠️  Ligne ${lineNumber} hors limites (max: ${data.length})`);
    continue;
  }

  const row = data[i];

  const oppData = {
    sheet: SHEET,
    rowIndex: lineNumber,
    numeroSociete: row[COL_NUMERO_SOCIETE],
    nom: row[COL_NOM],
    contact: row[COL_CONTACT],
    email: row[COL_EMAIL],
    numeroDevis: row[COL_NUMERO_DEVIS] ? String(row[COL_NUMERO_DEVIS]).trim() : null,
    dateDevis: row[COL_DATE_DEVIS],
    offre1: row[COL_OFFRE1],
    offre2: row[COL_OFFRE2],
    norme: row[COL_NORME],
    cp: row[COL_CP],
    ville: row[COL_VILLE],
    telephone: row[COL_TELEPHONE],
    statut: row[COL_STATUT]
  };

  extracted.push(oppData);

  console.log(`✓ Ligne ${lineNumber}:`);
  console.log(`  Numéro devis: ${oppData.numeroDevis}`);
  console.log(`  Société: ${oppData.numeroSociete} - ${oppData.nom}`);
  console.log(`  Contact: ${oppData.contact}`);
  console.log(`  Statut: ${oppData.statut}`);
  console.log('');
}

console.log(`\n📊 RÉSUMÉ: ${extracted.length} lignes extraites\n`);

// Sauvegarder
fs.writeFileSync('lines_103_104_data.json', JSON.stringify(extracted, null, 2));
console.log('✅ Données sauvegardées dans lines_103_104_data.json');
