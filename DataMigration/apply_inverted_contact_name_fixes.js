#!/usr/bin/env node
/**
 * Applique les corrections validées par fix_inverted_contact_names.js.
 *
 * Source de vérité : rapport JSON contenant les entrées `dry_run_fix`.
 * Écriture : GraphQL updatePerson pour rester compatible avec Twenty.
 *
 * Usage:
 *   node apply_inverted_contact_name_fixes.js --report "fix_inverted_contact_names_rapport_2026-05-12T06-38-00.json"
 *   node apply_inverted_contact_name_fixes.js --report "..." --dry-run
 *   node apply_inverted_contact_name_fixes.js --report "..." --limit 50
 */

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { graphqlRequest } = require('./lib/core/http');

const args = minimist(process.argv.slice(2));
const REPORT_FILE = args.report || 'fix_inverted_contact_names_rapport_2026-05-12T06-38-00.json';
const DRY_RUN = Boolean(args['dry-run']);
const LIMIT = args.limit ? parseInt(args.limit, 10) : null;

async function updatePersonName(personId, firstName, lastName) {
  const mutation = `
    mutation UpdatePersonName($id: ID!, $firstName: String!, $lastName: String!) {
      updatePerson(
        id: $id
        data: { name: { firstName: $firstName, lastName: $lastName } }
      ) {
        id
        name { firstName lastName }
      }
    }
  `;

  return graphqlRequest(mutation, {
    id: personId,
    firstName,
    lastName,
  });
}

async function main() {
  const reportPath = path.isAbsolute(REPORT_FILE)
    ? REPORT_FILE
    : path.join(__dirname, REPORT_FILE);

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const fixes = (report.details || []).filter((detail) => detail.result === 'dry_run_fix');
  const entries = LIMIT ? fixes.slice(0, LIMIT) : fixes;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(__dirname, `apply_inverted_contact_names_rapport_${timestamp}.json`);

  console.log('Application des corrections noms/prénoms — TWENTY CRM');
  console.log('Rapport :', path.basename(reportPath));
  if (DRY_RUN) console.log('Mode    : DRY RUN — aucune écriture');
  if (LIMIT) console.log('Limite  :', LIMIT);
  console.log(`Entrées : ${entries.length}`);
  console.log('');

  const stats = {
    total: entries.length,
    updated: 0,
    errors: 0,
  };
  const details = [];

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const current = entry.current || {};
    const expected = entry.expected || {};

    try {
      if (!DRY_RUN) {
        await updatePersonName(
          entry.personId,
          expected.firstName || '',
          expected.lastName || '',
        );
      }

      stats.updated += 1;
      details.push({
        key: entry.key,
        personId: entry.personId,
        reason: entry.reason,
        current,
        expected,
        result: DRY_RUN ? 'dry_run_applied' : 'updated',
      });
    } catch (error) {
      stats.errors += 1;
      details.push({
        key: entry.key,
        personId: entry.personId,
        reason: entry.reason,
        current,
        expected,
        result: 'error',
        error: String(error.message || error).slice(0, 300),
      });
    }

    if ((i + 1) % 20 === 0 || i + 1 === entries.length) {
      console.log(
        `${String(i + 1).padStart(4)}/${entries.length} | mis à jour:${stats.updated} | erreurs:${stats.errors}`,
      );
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    sourceReport: path.basename(reportPath),
    dryRun: DRY_RUN,
    stats,
    details,
  };
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));

  console.log('');
  console.log('Résumé');
  console.log('------');
  console.log(`Entrées traitées : ${stats.total}`);
  console.log(`Mises à jour     : ${stats.updated}${DRY_RUN ? ' (simulation)' : ''}`);
  console.log(`Erreurs          : ${stats.errors}`);
  console.log('');
  console.log('Rapport JSON :', path.basename(outFile));
}

main().catch((error) => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
