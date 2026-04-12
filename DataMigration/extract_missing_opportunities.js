#!/usr/bin/env node
/**
 * Extraire les données des 8 opportunités manquantes depuis Excel
 */

const xlsx = require('xlsx');

const FILE = 'SUIVIS CLIENTS 2026_V2.xlsx';
const MISSING_NUMEROS = [
  '108492-CL-1006',
  '108496-CLI-24225',
  '108497-CLI-24226',
  '108498-CLI-24227',
  '105718-CLI-24228',
  '104925-CLI-24229',
  '108621-CL-24347',
  '108673-CL-25031'
];

const wb = xlsx.readFile(FILE, { cellStyles: true });
const SHEETS = ['2023', '2024', '2025', '2026'];

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

console.log('🔍 Recherche des 8 opportunités manquantes...\n');

const found = [];

for (const sheetName of SHEETS) {
  const ws = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const numeroDevis = row[COL_NUMERO_DEVIS];

    if (numeroDevis && MISSING_NUMEROS.includes(String(numeroDevis).trim())) {
      const oppData = {
        sheet: sheetName,
        rowIndex: i + 1,
        numeroSociete: row[COL_NUMERO_SOCIETE],
        nom: row[COL_NOM],
        contact: row[COL_CONTACT],
        email: row[COL_EMAIL],
        numeroDevis: String(numeroDevis).trim(),
        dateDevis: row[COL_DATE_DEVIS],
        offre1: row[COL_OFFRE1],
        offre2: row[COL_OFFRE2],
        norme: row[COL_NORME],
        cp: row[COL_CP],
        ville: row[COL_VILLE],
        telephone: row[COL_TELEPHONE],
        statut: row[COL_STATUT]
      };

      found.push(oppData);
      console.log(`✓ Trouvé: ${oppData.numeroDevis} (${sheetName}, ligne ${i + 1})`);
      console.log(`  Société: ${oppData.numeroSociete} - ${oppData.nom}`);
      console.log(`  Contact: ${oppData.contact}`);
      console.log(`  Statut: ${oppData.statut}`);
      console.log('');
    }
  }
}

console.log(`\n📊 RÉSUMÉ: ${found.length}/${MISSING_NUMEROS.length} opportunités trouvées`);

if (found.length < MISSING_NUMEROS.length) {
  const notFound = MISSING_NUMEROS.filter(num =>
    !found.some(opp => opp.numeroDevis === num)
  );
  console.log('\n⚠️  Non trouvées dans Excel:');
  notFound.forEach(num => console.log(`  - ${num}`));
}

// Sauvegarder dans un fichier JSON pour le script d'import
const fs = require('fs');
fs.writeFileSync('missing_opportunities_data.json', JSON.stringify(found, null, 2));
console.log('\n✅ Données sauvegardées dans missing_opportunities_data.json');
