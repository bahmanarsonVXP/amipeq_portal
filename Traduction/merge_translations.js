#!/usr/bin/env node
/**
 * Fusionne les traductions FR de l'ancien fichier ODS avec le nouveau TSV
 *
 * Usage:
 *   node merge_translations.js <ancien_ods> <nouveau_tsv> [sortie]
 *
 * Exemple:
 *   node merge_translations.js twenty_metadata_fr.ods twenty_metadata_fr.tsv twenty_metadata_merged.tsv
 */

const fs = require('fs');
const xlsx = require('xlsx');

const OLD_FILE = process.argv[2] || 'twenty_metadata_fr.ods';
const NEW_FILE = process.argv[3] || 'twenty_metadata_fr.tsv';
const OUTPUT_FILE = process.argv[4] || 'twenty_metadata_merged.tsv';

if (!fs.existsSync(OLD_FILE)) {
  console.error(`❌ Fichier ancien non trouvé: ${OLD_FILE}`);
  process.exit(1);
}

if (!fs.existsSync(NEW_FILE)) {
  console.error(`❌ Fichier nouveau non trouvé: ${NEW_FILE}`);
  process.exit(1);
}

console.log('📖 Lecture des fichiers...\n');

// Read old file (ODS with French translations)
const oldWorkbook = xlsx.readFile(OLD_FILE);
const oldSheet = oldWorkbook.Sheets[oldWorkbook.SheetNames[0]];
const oldRows = xlsx.utils.sheet_to_json(oldSheet, { header: 1, defval: '' });

// Read new file (TSV with new UUIDs)
const newWorkbook = xlsx.readFile(NEW_FILE);
const newSheet = newWorkbook.Sheets[newWorkbook.SheetNames[0]];
const newRows = xlsx.utils.sheet_to_json(newSheet, { header: 1, defval: '' });

// Parse headers
const oldHeader = oldRows[0].map(c => String(c).trim());
const newHeader = newRows[0].map(c => String(c).trim());

// Flexible column matching (handles encoding issues)
const findColumn = (header, patterns) => {
  for (let i = 0; i < header.length; i++) {
    const col = header[i];
    if (patterns.some(p => col.includes(p) || p.includes(col))) {
      return i;
    }
  }
  return -1;
};

const oldColTech = findColumn(oldHeader, ['Nom technique']);
const oldColFR = findColumn(oldHeader, ['Label FR', 'modifier']);

const newColTech = findColumn(newHeader, ['Nom technique']);
const newColFR = findColumn(newHeader, ['Label FR', 'modifier']);

if (oldColTech === -1 || oldColFR === -1) {
  console.error('❌ Colonnes manquantes dans l\'ancien fichier');
  console.error('   En-tête:', oldHeader);
  process.exit(1);
}

if (newColTech === -1 || newColFR === -1) {
  console.error('❌ Colonnes manquantes dans le nouveau fichier');
  console.error('   En-tête:', newHeader);
  process.exit(1);
}

// Build translation map from old file (key = nom technique)
const translationMap = new Map();

for (let i = 1; i < oldRows.length; i++) {
  const row = oldRows[i];
  const techName = String(row[oldColTech] || '').trim();
  const frLabel = String(row[oldColFR] || '').trim();

  if (techName && frLabel) {
    translationMap.set(techName, frLabel);
  }
}

console.log(`📚 ${translationMap.size} traductions trouvées dans l'ancien fichier`);

// Apply translations to new file
let matched = 0;
let notFound = 0;

for (let i = 1; i < newRows.length; i++) {
  const row = newRows[i];
  const techName = String(row[newColTech] || '').trim();

  if (translationMap.has(techName)) {
    row[newColFR] = translationMap.get(techName);
    matched++;
  } else if (techName) {
    notFound++;
  }
}

console.log(`✅ ${matched} traductions appliquées`);
console.log(`⚠️  ${notFound} éléments sans traduction (nouveaux ou non traduits)`);

// Write merged TSV
const tsvContent = newRows.map(row => row.join('\t')).join('\n');
fs.writeFileSync(OUTPUT_FILE, tsvContent, 'utf-8');

console.log(`\n💾 Fichier fusionné: ${OUTPUT_FILE}`);
console.log(`\n📋 Prochaine étape:`);
console.log(`   node import_translations.js ${OUTPUT_FILE}`);
