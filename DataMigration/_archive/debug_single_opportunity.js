#!/usr/bin/env node
const xlsx = require('xlsx');

// Lire et traiter UNE ligne exactement comme le fait import_clients.js

const workbook = xlsx.readFile('SUIVIS CLIENTS 2026.xlsx');
const sheet = workbook.Sheets['2025'];
const allRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

// Ligne 385 (index 384)
const row = allRows[384];

console.log('🔍 DEBUG LIGNE 385 (108873-CL-25387)\n');
console.log('=' .repeat(80));

// Simuler le mapping fait dans readExcel()
const oppData = {
  prosp: row[0] || '',
  date: row[1] || '',
  numeroSociete: String(Math.floor(Number(row[2]))),
  client: row[3] || '',
  titre: row[4] || '',
  contact: row[5] || '',
  cial: row[6] || '',
  numeroDevis: row[7] || '',
  dateDevis: row[8] || '',
  offre1: row[9] || '',  // ← IMPORTANT
  offre2: row[10] || '', // ← IMPORTANT
  norme: row[11] || '',
  adresse1: row[16] || '',
  adresse2: row[17] || '',
  cp: row[18] || '',
  ville: row[19] || '',
  telephone: row[20] || '',
  relance: row[21] || '',
  email: row[22] || '',
  dateDocsEnvoyes: row[23] || '',
  annee: '2025',
  couleurDevis: ''
};

console.log('\n📋 Données extraites:\n');
console.log('  numeroDevis:', oppData.numeroDevis);
console.log('  offre1:', oppData.offre1, `(type: ${typeof oppData.offre1})`);
console.log('  offre2:', oppData.offre2, `(type: ${typeof oppData.offre2})`);

// Simuler le calcul fait dans createOpportunity()
console.log('\n\n🔢 Calcul des montants (comme dans createOpportunity):\n');

let tauxRemise = null;
let montantRemise = null;

console.log(`  Condition: if (oppData.offre1 && oppData.offre2)`);
console.log(`    oppData.offre1 = ${JSON.stringify(oppData.offre1)}`);
console.log(`    oppData.offre2 = ${JSON.stringify(oppData.offre2)}`);
console.log(`    oppData.offre1 && oppData.offre2 = ${oppData.offre1 && oppData.offre2}`);

if (oppData.offre1 && oppData.offre2) {
  const o1 = Number(oppData.offre1);
  const o2 = Number(oppData.offre2);
  console.log(`\n  Conversion en nombres:`);
  console.log(`    o1 = Number(${oppData.offre1}) = ${o1}`);
  console.log(`    o2 = Number(${oppData.offre2}) = ${o2}`);

  if (o1 > 0 && o2 > 0) {
    tauxRemise = Math.round((1 - o2 / o1) * 100);
    montantRemise = {
      amountMicros: Math.round(o2 * 1000000),
      currencyCode: 'EUR'
    };
    console.log(`\n  ✅ Calculs effectués:`);
    console.log(`    tauxRemise = ${tauxRemise}%`);
    console.log(`    montantRemise = ${montantRemise.amountMicros / 1000000} EUR`);
  } else {
    console.log(`\n  ❌ o1 ou o2 <= 0, pas de calcul`);
  }
} else {
  console.log(`\n  ❌ Condition FALSE - pas de calcul !`);
}

const montantPrincipal = oppData.offre2 || oppData.offre1;
console.log(`\n  montantPrincipal = oppData.offre2 || oppData.offre1 = ${montantPrincipal}`);

const amount = montantPrincipal ? {
  amountMicros: Math.round(Number(montantPrincipal) * 1000000),
  currencyCode: 'EUR'
} : null;

console.log(`\n  amount = ${amount ? `${amount.amountMicros / 1000000} EUR` : 'null'}`);

console.log('\n' + '=' .repeat(80));
console.log('\n💡 RÉSUMÉ:\n');
console.log(`  Amount qui sera envoyé: ${amount ? `${amount.amountMicros / 1000000} EUR` : 'NULL'}`);
console.log(`  Montant Remise: ${montantRemise ? `${montantRemise.amountMicros / 1000000} EUR` : 'NULL'}`);
console.log(`  Taux Remise: ${tauxRemise !== null ? `${tauxRemise}%` : 'NULL'}`);

console.log('\n' + '=' .repeat(80));
