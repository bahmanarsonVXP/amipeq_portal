#!/usr/bin/env node
/**
 * Import complet d'un onglet SUIVIS CLIENTS → TWENTY CRM
 * Crée ou retrouve : Company → Person (contact) → Opportunity
 *
 * Usage:
 *   node import_fichier_suivi_par_onglet.js --sheet 2026
 *   node import_fichier_suivi_par_onglet.js --sheet 2026 --file "Fichiers de suivi/MON_FICHIER.xlsx"
 *   node import_fichier_suivi_par_onglet.js --sheet 2026 --dry-run
 *   node import_fichier_suivi_par_onglet.js --sheet 2026 --limit 10
 *
 * Prérequis : toutes les lignes doivent avoir la colonne Y (Statut) remplie.
 * Le script vérifie cela avant tout import et s'arrête si des lignes sont incomplètes.
 *
 * Voir DOC_IMPORTS.md pour la documentation complète.
 */

const xlsx     = require('xlsx');
const minimist = require('minimist');
const { processExcelRow } = require('./lib/import-core');
const { normalizePhone } = require('./lib/parsers/phone');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// ─── Arguments CLI ────────────────────────────────────────────────────────────

const args       = minimist(process.argv.slice(2));
const SHEET      = args.sheet ? String(args.sheet) : null;
const EXCEL_FILE = args.file  || 'Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx';
const DRY_RUN    = args['dry-run'] || false;
const LIMIT      = args.limit ? parseInt(args.limit) : null;

if (!SHEET) {
  console.error('Erreur : argument --sheet obligatoire (ex: --sheet 2026)');
  process.exit(1);
}

console.log('Import SUIVIS CLIENTS → TWENTY CRM');
console.log('Fichier :', EXCEL_FILE);
console.log('Onglet  :', SHEET);
if (DRY_RUN) console.log('Mode DRY RUN — aucune écriture');
if (LIMIT)   console.log(`Limite    : ${LIMIT} lignes`);
console.log('');

// ─── Colonne Y → couleurDevis ─────────────────────────────────────────────────

function parseStatutY(val) {
  if (!val && val !== 0) return null;
  const v = String(val).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // retire les accents
  if (v === 'gagne')         return 'VERT';
  if (v === 'perdu')         return 'GRIS';
  if (v.includes('devis'))   return 'BLANC';
  return null;
}

// ─── Lecture Excel ────────────────────────────────────────────────────────────

function readSheet(filePath, sheetName) {
  const wb = xlsx.readFile(filePath, { cellStyles: true });

  if (!wb.SheetNames.includes(sheetName)) {
    console.error(`Erreur : onglet "${sheetName}" introuvable dans ${filePath}`);
    console.error(`Onglets disponibles : ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }

  const ws   = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  return { data, ws };
}

// ─── Pré-vérification colonne Y ───────────────────────────────────────────────

function verifierColonneY(data) {
  const manquantes = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[2]) continue; // ligne vide (pas de N° Sté)

    const y = row[24];
    if (!y && y !== 0) {
      const numLigne = i + 1; // numéro Excel (base 1, header = ligne 1)
      const client   = String(row[3] || '').trim();
      const numSte   = row[2] ? String(Math.floor(Number(row[2]))) : '?';
      manquantes.push({ numLigne, client, numSte });
    }
  }

  if (manquantes.length > 0) {
    console.error('ARRET — Colonne Y (Statut) incomplète\n');
    console.error('Les lignes suivantes n\'ont pas de statut renseigné :');
    manquantes.forEach(({ numLigne, client, numSte }) => {
      console.error(`  L${numLigne} — ${client || '(sans nom)'} (N°${numSte})`);
    });
    console.error(`\n${manquantes.length} ligne(s) incomplète(s) au total.`);
    console.error('Renseignez la colonne Y (Gagné / Perdu / Devis envoyé) pour toutes les lignes avant de relancer.\n');
    process.exit(1);
  }
}

// ─── Construction des rowData ─────────────────────────────────────────────────

function buildRows(data) {
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[2]) continue;

    const couleurDevis = parseStatutY(row[24]);

    rows.push({
      // Identifiants
      numeroSociete  : String(Math.floor(Number(row[2]))),
      nom            : String(row[3]  || '').trim(),
      // Contact
      titre          : String(row[4]  || '').trim(),
      contact        : String(row[5]  || '').trim(),
      // Opportunité
      numeroDevis    : String(row[7]  || '').trim(),
      dateDevis      : row[8]  || '',
      offre1         : row[9]  || '',
      offre2         : row[10] || '',
      norme          : String(row[11] || '').trim(),
      dateDocsEnvoyes: row[23] || '',
      date           : row[1]  || '',
      couleurDevis,
      // Adresse company
      cpRaw          : String(row[18] || '').trim(),
      cp             : row[18] || '',
      adresse1       : String(row[16] || '').trim(),
      ville          : String(row[19] || '').trim(),
      // Coordonnées person
      telephone      : normalizePhone(row[20]),
      email          : String(row[22] || '').trim(),
    });
  }

  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Lecture du fichier
  console.log('Lecture du fichier Excel...');
  const { data } = readSheet(EXCEL_FILE, SHEET);
  const totalLignes = data.slice(1).filter(r => r[2]).length;
  console.log(`${totalLignes} lignes trouvées dans l'onglet "${SHEET}"\n`);

  // 2. Pré-vérification colonne Y (bloquante)
  console.log('Vérification colonne Y (Statut)...');
  verifierColonneY(data);
  console.log('Colonne Y : OK — toutes les lignes ont un statut\n');

  // 3. Construction des données
  const rows    = buildRows(data);
  const limited = LIMIT ? rows.slice(0, LIMIT) : rows;
  if (LIMIT) console.log(`Limite appliquée : ${limited.length}/${rows.length} lignes\n`);

  // 4. Import
  const stats = {
    companies    : { created: 0, existing: 0, errors: 0 },
    persons      : { created: 0, existing: 0, skipped: 0, errors: 0 },
    opportunities: { created: 0, duplicate: 0, errors: 0 },
    totalErrors  : [],
  };

  const options = { dryRun: DRY_RUN };

  console.log('Import en cours...\n');

  for (let idx = 0; idx < limited.length; idx++) {
    const row    = limited[idx];
    const result = await processExcelRow(row, SHEET, options);

    // Compteurs
    if (result.company) {
      const s = result.company.status;
      if (s === 'created')       stats.companies.created++;
      else if (s === 'existing') stats.companies.existing++;
      else if (s === 'error')    stats.companies.errors++;
    }
    if (result.person) {
      const s = result.person.status;
      if (s === 'created')       stats.persons.created++;
      else if (s === 'existing') stats.persons.existing++;
      else if (s === 'skipped')  stats.persons.skipped++;
      else if (s === 'error')    stats.persons.errors++;
    }
    if (result.opportunity) {
      const s = result.opportunity.status;
      if (s === 'created')        stats.opportunities.created++;
      else if (s === 'duplicate') stats.opportunities.duplicate++;
      else if (s === 'error')     stats.opportunities.errors++;
    }

    if (result.errors.length > 0) {
      stats.totalErrors.push({
        ligne        : idx + 2,
        numeroSociete: row.numeroSociete,
        numeroDevis  : row.numeroDevis,
        errors       : result.errors,
      });
    }

    // Progression tous les 20 rows
    if ((idx + 1) % 20 === 0 || idx + 1 === limited.length) {
      console.log(
        `  ${idx + 1}/${limited.length}` +
        ` | companies +${stats.companies.created}` +
        ` | contacts +${stats.persons.created}` +
        ` | opps +${stats.opportunities.created} (${stats.opportunities.duplicate} doublons)`
      );
    }
  }

  // 5. Résumé
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT TERMINE\n');
  console.log(`Lignes traitées : ${limited.length}`);
  console.log('\nCompanies :');
  console.log(`  Créées    : ${stats.companies.created}`);
  console.log(`  Existantes: ${stats.companies.existing}`);
  console.log(`  Erreurs   : ${stats.companies.errors}`);
  console.log('\nContacts (Persons) :');
  console.log(`  Créés     : ${stats.persons.created}`);
  console.log(`  Existants : ${stats.persons.existing}`);
  console.log(`  Sans nom  : ${stats.persons.skipped}`);
  console.log(`  Erreurs   : ${stats.persons.errors}`);
  console.log('\nOpportunités :');
  console.log(`  Créées    : ${stats.opportunities.created}`);
  console.log(`  Doublons  : ${stats.opportunities.duplicate}`);
  console.log(`  Erreurs   : ${stats.opportunities.errors}`);

  if (stats.totalErrors.length > 0) {
    console.log(`\nERREURS (${stats.totalErrors.length} lignes) :`);
    stats.totalErrors.slice(0, 15).forEach(e => {
      console.log(`  L${e.ligne} — ${e.numeroDevis || e.numeroSociete}`);
      e.errors.forEach(err =>
        console.log(`    ${err.entity}: ${String(err.error).substring(0, 120)}`)
      );
    });
    if (stats.totalErrors.length > 15) {
      console.log(`  ... et ${stats.totalErrors.length - 15} autres erreurs`);
    }
  }

  console.log('='.repeat(60));
}

main().catch(console.error);
