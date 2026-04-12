#!/usr/bin/env node
const xlsx = require('xlsx');

const wb = xlsx.readFile('SUIVIS CLIENTS 2026.xlsx', { cellStyles: true, cellDates: false });
const ws = wb.Sheets['2023'];
const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

// Ligne 344 dans Excel = index 343 (0-based) après le header
const rowIndex = 343;
const row = data[rowIndex];

console.log('📍 Ligne 344 de l\'onglet 2023:\n');
console.log('Index dans le tableau:', rowIndex);
console.log('Colonne A (PROSP):', row[0]);
console.log('Colonne B (DATE):', row[1]);
console.log('Colonne C (N° Société):', row[2]);
console.log('Colonne D (CLIENT):', row[3]);
console.log('Colonne E (TITRE):', row[4]);
console.log('Colonne F (CONTACT):', row[5]);
console.log('Colonne G (CIAL):', row[6]);
console.log('Colonne H (N° DEVIS):', row[7]);
console.log('Colonne I (DATE DEVIS):', row[8], '← CETTE VALEUR');
console.log('Colonne J (OFFRE 1):', row[9]);
console.log('Colonne K (OFFRE 2):', row[10]);
console.log('Colonne L (NORME):', row[11]);

// Chercher "BAIE MAHAULT" dans toutes les lignes
console.log('\n\n🔍 Recherche de "BAIE MAHAULT" dans tout l\'onglet 2023:\n');
let found = false;
for (let i = 0; i < data.length; i++) {
  for (let j = 0; j < data[i].length; j++) {
    const cell = String(data[i][j] || '').toUpperCase();
    if (cell.includes('BAIE MAHAULT') || cell.includes('BAIE-MAHAULT')) {
      console.log(`Trouvé à la ligne ${i + 1}, colonne ${String.fromCharCode(65 + j)}: "${data[i][j]}"`);
      console.log('Contexte:', {
        numeroDevis: data[i][7],
        client: data[i][3],
        contact: data[i][5]
      });
      found = true;
    }
  }
}

if (!found) {
  console.log('❌ "BAIE MAHAULT" non trouvé dans l\'onglet 2023');
}
