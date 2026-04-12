#!/usr/bin/env node
/**
 * AMIPEQ CRM Excel Import - Master Orchestration Script
 *
 * Modular architecture for flexible Excel imports to TWENTY CRM
 *
 * Usage:
 *   # Import full file (all sheets 2023-2026)
 *   node import-master.js --file "SUIVISCLIENTS_2026_V2.xlsx"
 *
 *   # Import specific sheets only
 *   node import-master.js --file "SUIVISCLIENTS_2026_V2.xlsx" --sheets "2025,2026"
 *
 *   # Dry run (validation only)
 *   node import-master.js --file "SUIVISCLIENTS_2026_V2.xlsx" --dry-run
 *
 *   # Skip existing companies/persons (opportunities only)
 *   node import-master.js --file "SUIVISCLIENTS_2026_V2.xlsx" --skip-companies --skip-persons
 *
 *   # Limit to N rows (testing)
 *   node import-master.js --file "SUIVISCLIENTS_2026_V2.xlsx" --limit 50
 */

const xlsx = require('xlsx');
const minimist = require('minimist');
const { processExcelRow } = require('./lib/import-core');
const { getCellColor } = require('./lib/parsers/excel');

// Parse CLI arguments
const args = minimist(process.argv.slice(2));

const EXCEL_FILE = args.file || 'SUIVISCLIENTS_2026_V2.xlsx';
const SHEETS = args.sheets
  ? (typeof args.sheets === 'string' ? args.sheets.split(',') : [args.sheets.toString()])
  : ['2023', '2024', '2025', '2026'];
const DRY_RUN = args['dry-run'] || false;
const SKIP_COMPANIES = args['skip-companies'] || false;
const SKIP_PERSONS = args['skip-persons'] || false;
const SKIP_OPPORTUNITIES = args['skip-opportunities'] || false;
const LIMIT = args.limit ? parseInt(args.limit) : null;

console.log('🚀 Import AMIPEQ CRM depuis Excel\n');
console.log('📁 Fichier:', EXCEL_FILE);
console.log('📊 Onglets:', SHEETS.join(', '));
if (DRY_RUN) console.log('⚠️  Mode DRY RUN - aucune création');
if (SKIP_COMPANIES) console.log('⏭️  Skip companies');
if (SKIP_PERSONS) console.log('⏭️  Skip persons');
if (SKIP_OPPORTUNITIES) console.log('⏭️  Skip opportunities');
if (LIMIT) console.log(`🔢 Limite: ${LIMIT} lignes par onglet`);
console.log('');

async function main() {
  const wb = xlsx.readFile(EXCEL_FILE, { cellStyles: true });

  let stats = {
    companies: { created: 0, existing: 0, errors: 0, skipped: 0 },
    persons: { created: 0, existing: 0, errors: 0, skipped: 0 },
    opportunities: { created: 0, duplicate: 0, errors: 0, skipped: 0 },
    totalProcessed: 0,
    totalErrors: []
  };

  for (const sheetName of SHEETS) {
    if (!wb.SheetNames.includes(sheetName)) {
      console.log(`⚠️  Onglet ${sheetName} non trouvé`);
      continue;
    }

    console.log(`\n📋 Traitement onglet ${sheetName}...`);

    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

    let rowsProcessed = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Skip if no numeroSociete
      if (!row[2]) continue;

      // Apply limit if specified
      if (LIMIT && rowsProcessed >= LIMIT) {
        console.log(`  🔢 Limite atteinte (${LIMIT} lignes)`);
        break;
      }

      // Extract cell color for opportunity
      const cellRef = xlsx.utils.encode_cell({ r: i, c: 8 });
      const cell = ws[cellRef];
      const couleurDevis = getCellColor(cell);

      // Build rowData object
      const rowData = {
        numeroSociete: String(Math.floor(Number(row[2]))),
        nom: row[3] || '',
        cpRaw: row[18] || '',       // col 18 = CP réel (corrigé, était col 4 = Titre)
        contact: row[5] || '',
        email: row[22] || '',       // col 22 = E-mail réel (corrigé, était col 6 = CIAL)
        telephone: row[20] || '',   // col 20 = TELEPHONE réel (corrigé, était col 7 = N° DEVIS)
        numeroDevis: row[7] || '',
        dateDevis: row[8] || '',
        offre1: row[9] || '',
        offre2: row[10] || '',
        norme: row[11] || '',
        adresse1: row[16] || '',    // col 16 = Adresse Ligne 1
        ville: row[19] || '',       // col 19 = VILLE (corrigé, était col 12 = vide)
        cp: row[18] || '',          // col 18 = CP
        dateDocsEnvoyes: row[23] || '',
        couleurDevis,
        date: row[1] || ''
      };

      // Processing options
      const options = {
        skipCompany: SKIP_COMPANIES,
        skipPerson: SKIP_PERSONS,
        skipOpportunity: SKIP_OPPORTUNITIES,
        dryRun: DRY_RUN
      };

      // Process the row
      const result = await processExcelRow(rowData, sheetName, options);

      // Update stats
      if (result.company) {
        stats.companies[result.company.status] = (stats.companies[result.company.status] || 0) + 1;
      }
      if (result.person) {
        stats.persons[result.person.status] = (stats.persons[result.person.status] || 0) + 1;
      }
      if (result.opportunity) {
        stats.opportunities[result.opportunity.status] = (stats.opportunities[result.opportunity.status] || 0) + 1;
      }

      // Collect errors
      if (result.errors.length > 0) {
        stats.totalErrors.push({
          sheet: sheetName,
          row: i + 1,
          numeroSociete: rowData.numeroSociete,
          numeroDevis: rowData.numeroDevis,
          errors: result.errors
        });
      }

      stats.totalProcessed++;
      rowsProcessed++;

      // Progress display (every 50 rows)
      if (stats.totalProcessed % 50 === 0) {
        console.log(`  Progression: ${stats.totalProcessed} lignes traitées`);
        console.log(`    Companies: ${stats.companies.created} créées, ${stats.companies.existing} existantes`);
        console.log(`    Opportunities: ${stats.opportunities.created} créées, ${stats.opportunities.duplicate} doublons`);
      }
    }

    console.log(`  ✅ ${sheetName}: ${rowsProcessed} lignes traitées`);
  }

  // Final report
  console.log('\n' + '='.repeat(60));
  console.log('✅ IMPORT TERMINÉ\n');
  console.log(`📊 STATISTIQUES:`);
  console.log(`  Lignes traitées: ${stats.totalProcessed}`);
  console.log(`\n  Companies:`);
  console.log(`    Créées:     ${stats.companies.created}`);
  console.log(`    Existantes: ${stats.companies.existing}`);
  console.log(`    Erreurs:    ${stats.companies.errors}`);
  if (stats.companies.skipped) console.log(`    Skipped:    ${stats.companies.skipped}`);
  console.log(`\n  Persons:`);
  console.log(`    Créées:     ${stats.persons.created}`);
  console.log(`    Existantes: ${stats.persons.existing}`);
  console.log(`    Erreurs:    ${stats.persons.errors}`);
  if (stats.persons.skipped) console.log(`    Skipped:    ${stats.persons.skipped}`);
  console.log(`\n  Opportunities:`);
  console.log(`    Créées:     ${stats.opportunities.created}`);
  console.log(`    Doublons:   ${stats.opportunities.duplicate}`);
  console.log(`    Erreurs:    ${stats.opportunities.errors}`);
  if (stats.opportunities.skipped) console.log(`    Skipped:    ${stats.opportunities.skipped}`);

  if (stats.totalErrors.length > 0) {
    console.log(`\n⚠️  ERREURS (${stats.totalErrors.length} lignes):`);
    stats.totalErrors.slice(0, 10).forEach(err => {
      console.log(`  Ligne ${err.row} (${err.sheet}): ${err.numeroDevis || err.numeroSociete}`);
      err.errors.forEach(e => {
        console.log(`    - ${e.entity}: ${e.error.substring(0, 100)}`);
      });
    });
    if (stats.totalErrors.length > 10) {
      console.log(`  ... et ${stats.totalErrors.length - 10} autres erreurs`);
    }
  }

  console.log('='.repeat(60));
}

main().catch(console.error);
