#!/usr/bin/env node
/**
 * Vérifier si les 9 erreurs du fichier V1 existent encore dans V2
 */

const xlsx = require('xlsx');

const V2_FILE = '/Users/bahmanarson/projects/AMIPEQ_CRM/DataMigration/SUIVISCLIENTS_2026_V2.xlsx';

console.log('🔍 Vérification des 9 erreurs dans le fichier V2\n');
console.log('📁 Fichier:', V2_FILE);
console.log('');

const wb = xlsx.readFile(V2_FILE, { cellStyles: true });

const errorsFound = [];
const errorsFixed = [];

// Erreur 1: Date invalide - Onglet 2023, Ligne 344, Colonne I
console.log('1️⃣ Vérification: Date invalide (2023, ligne 344)');
if (wb.SheetNames.includes('2023')) {
  const ws = wb.Sheets['2023'];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

  if (data[343]) { // Ligne 344 = index 343
    const dateDevis = data[343][8]; // Colonne I = index 8
    const numeroDevis = data[343][7]; // Colonne H
    const numeroSociete = data[343][2]; // Colonne C

    console.log(`   Ligne 344: ${numeroDevis || 'N/A'}`);
    console.log(`   Date (col I): ${dateDevis}`);

    if (typeof dateDevis === 'string' && dateDevis.includes('MAHAULT')) {
      errorsFound.push({
        type: 'Date invalide',
        sheet: '2023',
        row: 344,
        numeroDevis,
        issue: `Date contient "MAHAULT": ${dateDevis}`
      });
      console.log('   ❌ ERREUR: Date invalide détectée\n');
    } else {
      errorsFixed.push('Date invalide (2023, ligne 344) - CORRIGÉE');
      console.log('   ✅ OK: Date valide\n');
    }
  }
}

// Erreur 2-7: Numéros de devis invalides
const invalidNumeros = [
  { sheet: '2024', row: 106, expected: '108496' },
  { sheet: '2024', row: 107, expected: '108497' },
  { sheet: '2024', row: 108, expected: '108498' },
  { sheet: '2024', row: 109, expected: '105718' },
  { sheet: '2024', row: 110, expected: '104925' },
  { sheet: '2025', row: 114, expected: '105718-CL-25112' }
];

console.log('2️⃣ Vérification: Numéros de devis invalides');
invalidNumeros.forEach((check, idx) => {
  if (wb.SheetNames.includes(check.sheet)) {
    const ws = wb.Sheets[check.sheet];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

    if (data[check.row - 1]) { // row est 1-indexed
      const numeroDevis = data[check.row - 1][7]; // Colonne H
      const numeroSociete = data[check.row - 1][2]; // Colonne C

      console.log(`   ${check.sheet}, ligne ${check.row}: ${numeroDevis || 'N/A'}`);

      // Vérifier format: doit contenir "-CL-"
      if (!numeroDevis || !String(numeroDevis).includes('-CL-')) {
        errorsFound.push({
          type: 'Numéro invalide',
          sheet: check.sheet,
          row: check.row,
          numeroDevis,
          issue: 'Format incomplet (manque -CL-XXXXX)'
        });
        console.log('   ❌ ERREUR: Format invalide');
      } else {
        errorsFixed.push(`Numéro invalide (${check.sheet}, ligne ${check.row}) - CORRIGÉ`);
        console.log('   ✅ OK: Format valide');
      }
    }
  }
});
console.log('');

// Erreur 8-9: Companies manquantes
console.log('3️⃣ Vérification: Companies manquantes');

// Company 108621 - EKOPLAST (2024, ligne 362)
if (wb.SheetNames.includes('2024')) {
  const ws = wb.Sheets['2024'];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

  if (data[361]) { // Ligne 362 = index 361
    const numeroSociete = String(Math.floor(Number(data[361][2])));
    const nom = data[361][3];
    const numeroDevis = data[361][7];

    console.log(`   2024, ligne 362: ${numeroSociete} - ${nom}`);
    console.log(`   Numéro devis: ${numeroDevis}`);

    if (numeroSociete === '108621') {
      // Cette company devrait exister maintenant (importée avec import_new_companies_2026.js)
      console.log('   ⚠️  NOTE: Company 108621 devrait avoir été créée\n');
    } else {
      errorsFixed.push('Company 108621 (2024, ligne 362) - Ligne différente ou corrigée');
      console.log('   ✅ Ligne modifiée ou corrigée\n');
    }
  }
}

// Company 108673 - ISIS SARL (2025, ligne 33)
if (wb.SheetNames.includes('2025')) {
  const ws = wb.Sheets['2025'];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

  if (data[32]) { // Ligne 33 = index 32
    const numeroSociete = String(Math.floor(Number(data[32][2])));
    const nom = data[32][3];
    const numeroDevis = data[32][7];

    console.log(`   2025, ligne 33: ${numeroSociete} - ${nom}`);
    console.log(`   Numéro devis: ${numeroDevis}`);

    if (numeroSociete === '108673') {
      console.log('   ⚠️  NOTE: Company 108673 devrait avoir été créée\n');
    } else {
      errorsFixed.push('Company 108673 (2025, ligne 33) - Ligne différente ou corrigée');
      console.log('   ✅ Ligne modifiée ou corrigée\n');
    }
  }
}

// Rapport final
console.log('='.repeat(60));
console.log('📊 RÉSUMÉ\n');

if (errorsFound.length > 0) {
  console.log(`❌ ERREURS TROUVÉES: ${errorsFound.length}\n`);
  errorsFound.forEach((err, idx) => {
    console.log(`${idx + 1}. ${err.type} - ${err.sheet}, ligne ${err.row}`);
    console.log(`   Numéro devis: ${err.numeroDevis || 'N/A'}`);
    console.log(`   Problème: ${err.issue}\n`);
  });
} else {
  console.log('✅ Aucune erreur trouvée!\n');
}

if (errorsFixed.length > 0) {
  console.log(`✅ ERREURS CORRIGÉES: ${errorsFixed.length}\n`);
  errorsFixed.forEach((fix, idx) => {
    console.log(`${idx + 1}. ${fix}`);
  });
}

console.log('='.repeat(60));
