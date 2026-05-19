#!/usr/bin/env node
/**
 * Import des opportunities depuis SUIVISCLIENTS_2026_V2.xlsx
 * Avec déduplication automatique
 */

const https = require('https');
const fs = require('fs');
const xlsx = require('xlsx');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

const EXCEL_FILE = '/Users/bahmanarson/projects/AMIPEQ_CRM/DataMigration/SUIVISCLIENTS_2026_V2.xlsx';
const MAPPINGS_FILE = 'mappings.json';

console.log('🚀 Import OPPORTUNITIES depuis SUIVISCLIENTS_2026_V2.xlsx\n');
console.log('📁 Fichier:', EXCEL_FILE);
console.log('🔗 Instance:', BASE_URL);
console.log('');

// Charger les mappings (mis à jour avec les nouvelles companies)
const mappings = JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf-8'));

// [Copier toutes les fonctions du script import_opportunities_only.js]
// Je vais les copier depuis le fichier existant


function readExcel() {
  console.log('📖 Lecture du fichier Excel...\n');

  const wb = xlsx.readFile(EXCEL_FILE, { cellStyles: true });
  const sheets = ['2023', '2024', '2025', '2026'];
  const allRows = [];

  for (const sheetName of sheets) {
    if (!wb.SheetNames.includes(sheetName)) {
      console.log(`  ⚠️  Onglet ${sheetName} non trouvé`);
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (!row[2]) continue;

      const cellRef = xlsx.utils.encode_cell({ r: i, c: 8 });
      const cell = ws[cellRef];
      const couleurDevis = getCellColor(cell);

      allRows.push({
        annee: sheetName,
        numeroSociete: String(Math.floor(Number(row[2]))),
        contact: row[5] || '',
        numeroDevis: row[7] || '',
        dateDevis: row[8] || '',
        offre1: row[9] || '',
        offre2: row[10] || '',
        norme: row[11] || '',
        dateDocsEnvoyes: row[23] || '',
        couleurDevis,
        date: row[1] || ''
      });
    }

    console.log(`  ✅ ${sheetName}: ${data.length - 1} lignes`);
  }

  console.log(`\n📊 Total: ${allRows.length} opportunities\n`);
  return allRows;
}

async function main() {
  try {
    const opportunities = readExcel();

    console.log('💼 Import Opportunities...\n');
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const opp of opportunities) {
      const result = await createOpportunity(opp);
      if (result === 'SKIPPED') {
        skipped++;
      } else if (result) {
        created++;
      } else {
        errors++;
      }

      const total = created + skipped;
      if (total % 50 === 0) {
        console.log(`  Progression: ${total}/${opportunities.length} (créées: ${created}, skipped: ${skipped})`);
      }
      await sleep(650);
    }

    console.log(`\n✅ ${created} opportunities créées`);
    if (skipped > 0) {
      console.log(`⏭️  ${skipped} doublons skippés`);
    }
    if (errors > 0) {
      console.log(`⚠️  ${errors} erreurs`);
    }

    console.log('\n============================================================');
    console.log('✅ IMPORT TERMINÉ\n');
    console.log(`Opportunities: ${created} créées`);
    console.log(`Doublons:      ${skipped} skippés`);
    console.log(`Erreurs:       ${errors}`);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  }
}

main().catch(console.error);
