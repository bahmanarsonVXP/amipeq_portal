#!/usr/bin/env node
/**
 * Répare les contacts Twenty dont firstName/lastName ont été inversés.
 *
 * Stratégie :
 * - source de vérité = Excel suivi clients
 * - matching personne = mappings -> email -> téléphone -> nom
 * - correction uniquement pour les cas évidents :
 *   - prénom/nom inversés
 *   - découpage "brut" type firstName="DECEBAL" lastName="Pascal"
 *
 * Usage :
 *   node fix_inverted_contact_names.js --dry-run
 *   node fix_inverted_contact_names.js --limit 50
 *   node fix_inverted_contact_names.js --company 106695 --dry-run
 */

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const xlsx = require('xlsx');
const { graphqlRequest } = require('./lib/core/http');
const mappings = require('./lib/core/mappings');
const {
  buildPersonNameCandidates,
  normalizeComparableName,
  parseContactName,
} = require('./lib/parsers/contact-name');
const { normalizePhone } = require('./lib/parsers/phone');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const args = minimist(process.argv.slice(2));
const EXCEL_FILE = args.file || 'Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx';
const SHEETS = args.sheets
  ? String(args.sheets).split(',').map((s) => s.trim()).filter(Boolean)
  : ['2023', '2024', '2025', '2026'];
const DRY_RUN = Boolean(args['dry-run']);
const LIMIT = args.limit ? parseInt(args.limit, 10) : null;
const COMPANY_FILTER = args.company ? String(args.company).trim() : null;

function splitEmails(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\/;,]/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

function buildExcelContacts(filePath, sheets) {
  const wb = xlsx.readFile(filePath, { cellStyles: false });
  const map = new Map();

  for (const sheet of sheets) {
    if (!wb.SheetNames.includes(sheet)) continue;
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '', raw: true });

    for (let i = 1; i < data.length; i += 1) {
      const row = data[i];
      if (!row[2]) continue;

      const numeroSociete = String(Math.floor(Number(row[2])));
      if (COMPANY_FILTER && numeroSociete !== COMPANY_FILTER) continue;

      const contact = String(row[5] || '').trim();
      if (!contact) continue;

      const parsed = parseContactName(contact);
      if (!parsed.firstName && !parsed.lastName) continue;

      const key = `${numeroSociete}|${contact}`;
      if (map.has(key)) continue;

      map.set(key, {
        key,
        numeroSociete,
        contact,
        titre: String(row[4] || '').trim(),
        email: splitEmails(row[22])[0] || null,
        emails: splitEmails(row[22]),
        telephone: normalizePhone(row[20]),
        expectedFirstName: parsed.firstName || '',
        expectedLastName: parsed.lastName || '',
      });
    }
  }

  return [...map.values()];
}

async function fetchPeopleByCompany(companyId) {
  const query = `
    query PeopleByCompany($filter: PersonFilterInput!, $first: Int) {
      people(filter: $filter, first: $first) {
        edges {
          node {
            id
            name { firstName lastName }
            emails { primaryEmail }
            phones { primaryPhoneNumber }
          }
        }
      }
    }
  `;

  const data = await graphqlRequest(query, {
    filter: { companyId: { eq: companyId } },
    first: 500,
  });

  return data?.people?.edges?.map((edge) => edge.node) || [];
}

function normalizePhoneForCompare(value) {
  return String(value || '').replace(/\D/g, '');
}

function findPersonByEmail(people, emails) {
  if (!emails.length) return null;
  const emailSet = new Set(emails.map((email) => email.toLowerCase()));
  const matches = people.filter((person) => {
    const email = String(person.emails?.primaryEmail || '').trim().toLowerCase();
    return email && emailSet.has(email);
  });
  return matches.length === 1 ? matches[0] : null;
}

function findPersonByPhone(people, telephone) {
  const target = normalizePhoneForCompare(telephone);
  if (!target) return null;
  const matches = people.filter((person) => {
    const phone = normalizePhoneForCompare(person.phones?.primaryPhoneNumber);
    return phone && phone === target;
  });
  return matches.length === 1 ? matches[0] : null;
}

function findPersonByName(people, contact) {
  const target = normalizeComparableName(contact);
  if (!target) return { person: null, ambiguous: false };

  const matches = people.filter((person) => buildPersonNameCandidates(person).includes(target));
  if (matches.length === 1) return { person: matches[0], ambiguous: false };
  if (matches.length > 1) return { person: null, ambiguous: true };
  return { person: null, ambiguous: false };
}

function classifyIssue(person, row) {
  const currentFirstName = String(person?.name?.firstName || '').trim();
  const currentLastName = String(person?.name?.lastName || '').trim();
  const expectedFirstName = String(row.expectedFirstName || '').trim();
  const expectedLastName = String(row.expectedLastName || '').trim();

  const firstMatches =
    normalizeComparableName(currentFirstName) === normalizeComparableName(expectedFirstName);
  const lastMatches =
    normalizeComparableName(currentLastName) === normalizeComparableName(expectedLastName);

  if (firstMatches && lastMatches) {
    return { needsFix: false, reason: 'unchanged' };
  }

  const swapped =
    normalizeComparableName(currentFirstName) === normalizeComparableName(expectedLastName) &&
    normalizeComparableName(currentLastName) === normalizeComparableName(expectedFirstName);

  if (swapped) {
    return { needsFix: true, reason: 'swapped' };
  }

  const rawName = normalizeComparableName(row.contact);
  const currentFull = normalizeComparableName(`${currentFirstName} ${currentLastName}`);
  if (rawName && currentFull === rawName) {
    return { needsFix: true, reason: 'raw_split' };
  }

  if (!currentLastName && normalizeComparableName(currentFirstName) === normalizeComparableName(expectedLastName)) {
    return { needsFix: true, reason: 'lastname_missing' };
  }

  if (!currentFirstName && normalizeComparableName(currentLastName) === normalizeComparableName(expectedFirstName)) {
    return { needsFix: true, reason: 'firstname_missing' };
  }

  if (
    !expectedFirstName &&
    normalizeComparableName(currentFirstName) === normalizeComparableName(expectedLastName) &&
    normalizeComparableName(currentLastName) === normalizeComparableName(expectedLastName)
  ) {
    return { needsFix: true, reason: 'duplicated_single_token' };
  }

  return { needsFix: false, reason: 'mismatch_not_safe' };
}

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
  console.log('Réparation des noms/prénoms inversés — TWENTY CRM');
  console.log('Excel   :', EXCEL_FILE);
  console.log('Onglets :', SHEETS.join(', '));
  if (COMPANY_FILTER) console.log('Société :', COMPANY_FILTER);
  if (DRY_RUN) console.log('Mode    : DRY RUN — aucune écriture');
  if (LIMIT) console.log('Limite  :', LIMIT);
  console.log('');

  const rows = buildExcelContacts(EXCEL_FILE, SHEETS);
  const entries = LIMIT ? rows.slice(0, LIMIT) : rows;
  const companyCache = new Map();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportFile = path.join(__dirname, `fix_inverted_contact_names_rapport_${timestamp}.json`);

  const stats = {
    total: entries.length,
    matchedByMapping: 0,
    matchedByEmail: 0,
    matchedByPhone: 0,
    matchedByName: 0,
    fixed: 0,
    unchanged: 0,
    skippedNoCompany: 0,
    skippedNoPerson: 0,
    skippedAmbiguous: 0,
    skippedUnsafe: 0,
    errors: 0,
  };
  const details = [];

  for (const row of entries) {
    try {
      const companyId = mappings.getCompany(row.numeroSociete);
      if (!companyId) {
        stats.skippedNoCompany += 1;
        details.push({ key: row.key, result: 'skipped_no_company' });
        continue;
      }

      if (!companyCache.has(companyId)) {
        companyCache.set(companyId, await fetchPeopleByCompany(companyId));
      }
      const people = companyCache.get(companyId);

      let person = null;
      const mappedId = mappings.getPerson(row.numeroSociete, row.contact);
      if (mappedId) {
        person = people.find((candidate) => candidate.id === mappedId) || null;
        if (person) stats.matchedByMapping += 1;
      }

      if (!person) {
        person = findPersonByEmail(people, row.emails);
        if (person) stats.matchedByEmail += 1;
      }

      if (!person) {
        person = findPersonByPhone(people, row.telephone);
        if (person) stats.matchedByPhone += 1;
      }

      if (!person) {
        const nameLookup = findPersonByName(people, row.contact);
        if (nameLookup.ambiguous) {
          stats.skippedAmbiguous += 1;
          details.push({ key: row.key, result: 'skipped_ambiguous_name' });
          continue;
        }
        person = nameLookup.person;
        if (person) stats.matchedByName += 1;
      }

      if (!person) {
        stats.skippedNoPerson += 1;
        details.push({ key: row.key, result: 'skipped_no_person' });
        continue;
      }

      const issue = classifyIssue(person, row);
      if (!issue.needsFix) {
        if (issue.reason === 'unchanged') {
          stats.unchanged += 1;
        } else {
          stats.skippedUnsafe += 1;
        }
        details.push({
          key: row.key,
          personId: person.id,
          result: issue.reason,
          current: person.name,
          expected: {
            firstName: row.expectedFirstName,
            lastName: row.expectedLastName,
          },
        });
        continue;
      }

      const detail = {
        key: row.key,
        personId: person.id,
        result: DRY_RUN ? 'dry_run_fix' : 'fixed',
        reason: issue.reason,
        current: {
          firstName: person.name?.firstName || '',
          lastName: person.name?.lastName || '',
        },
        expected: {
          firstName: row.expectedFirstName,
          lastName: row.expectedLastName,
        },
      };

      if (!DRY_RUN) {
        await updatePersonName(person.id, row.expectedFirstName, row.expectedLastName);
      }

      stats.fixed += 1;
      details.push(detail);
    } catch (error) {
      stats.errors += 1;
      details.push({
        key: row.key,
        result: 'error',
        error: String(error.message || error).slice(0, 300),
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    file: EXCEL_FILE,
    sheets: SHEETS,
    companyFilter: COMPANY_FILTER,
    stats,
    details,
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log('Résumé');
  console.log('------');
  console.log(`Entrées analysées  : ${stats.total}`);
  console.log(`Corrigées          : ${stats.fixed}${DRY_RUN ? ' (simulation)' : ''}`);
  console.log(`Déjà conformes     : ${stats.unchanged}`);
  console.log(`Sans société       : ${stats.skippedNoCompany}`);
  console.log(`Sans personne      : ${stats.skippedNoPerson}`);
  console.log(`Ambiguës           : ${stats.skippedAmbiguous}`);
  console.log(`Non sûres          : ${stats.skippedUnsafe}`);
  console.log(`Erreurs            : ${stats.errors}`);
  console.log('');
  console.log('Rapport JSON :', path.basename(reportFile));
}

main().catch((error) => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
