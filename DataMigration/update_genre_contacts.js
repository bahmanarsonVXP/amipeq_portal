#!/usr/bin/env node
/**
 * update_genre_contacts.js
 *
 * Met à jour en masse sur les contacts existants dans Twenty CRM :
 *   - le champ `genre`  (civilité : col E = Titre)
 *   - le champ `email`  (col W = E-mail) — uniquement si absent dans Twenty
 *
 * Stratégie email : récupère d'abord tous les contacts sans email dans Twenty
 * (1 seule requête GraphQL), puis ne patche que ceux-là → zéro écrasement.
 *
 * Usage:
 *   node update_genre_contacts.js
 *   node update_genre_contacts.js --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx"
 *   node update_genre_contacts.js --sheets "2026,2025,2024,2023"
 *   node update_genre_contacts.js --dry-run
 *   node update_genre_contacts.js --limit 50
 */

const xlsx     = require('xlsx');
const minimist = require('minimist');
const fs       = require('fs');
const path     = require('path');
const { graphqlRequest } = require('./lib/core/http');
const mappings = require('./lib/core/mappings');
const { parseTitre } = require('./lib/entities/person');
const { parseContactName } = require('./lib/parsers/contact-name');
const { normalizePhone } = require('./lib/parsers/phone');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args       = minimist(process.argv.slice(2));
const EXCEL_FILE = args.file   || 'Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx';
const SHEETS     = args.sheets
  ? String(args.sheets).split(',').map(s => s.trim()).filter(Boolean)
  : ['2023', '2024', '2025', '2026'];
const DRY_RUN    = Boolean(args['dry-run']);
const LIMIT      = args.limit ? parseInt(args.limit, 10) : null;

// ─── Lecture Excel ────────────────────────────────────────────────────────────

/**
 * Construit une Map unique (numeroSociete|contact) → { genre, email, telephone }
 * Col E (index 4)  = Titre (civilité)
 * Col F (index 5)  = Contact (nom)
 * Col U (index 20) = Téléphone
 * Col W (index 22) = E-mail
 */
function buildContactMap(filePath, sheets) {
  const wb  = xlsx.readFile(filePath, { cellStyles: false });
  const map = new Map();

  for (const sheet of sheets) {
    if (!wb.SheetNames.includes(sheet)) {
      console.log(`  Onglet "${sheet}" introuvable, ignoré.`);
      continue;
    }
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '', raw: true });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[2]) continue;

      const numeroSociete = String(Math.floor(Number(row[2])));
      const titre         = String(row[4]  || '').trim();
      const contact       = String(row[5]  || '').trim();
      const emailRaw      = String(row[22] || '').trim().toLowerCase();

      if (!contact) continue;

      const genre     = parseTitre(titre);
      const email     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;
      const telephone = normalizePhone(row[20]);

      // Skip les lignes sans aucune donnée utile
      if (!genre && !email && !telephone) continue;

      const key = `${numeroSociete}|${contact}`;
      if (!map.has(key)) {
        map.set(key, { numeroSociete, contact, genre, email, telephone });
      }
    }
  }

  return map;
}

// ─── Récupérer tous les IDs de contacts sans email / sans téléphone ──────────

async function fetchPersonIdsWithout(field, filter) {
  const ids = new Set();
  let cursor = null;

  console.log(`Récupération des contacts sans ${field} dans Twenty...`);

  const query = `
    query PeopleNoField($filter: PersonFilterInput!, $after: String) {
      people(filter: $filter, first: 500, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node { id } }
      }
    }
  `;

  do {
    const data  = await graphqlRequest(query, { filter, after: cursor });
    const page  = data?.people;
    const edges = page?.edges || [];

    for (const e of edges) ids.add(e.node.id);

    cursor = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);

  console.log(`  → ${ids.size} contacts sans ${field}`);
  return ids;
}

// ─── Fallback GraphQL si person absente du cache ──────────────────────────────

async function findPersonByName(contact) {
  const { firstName, lastName } = parseContactName(contact);

  const query = `
    query FindPerson($filter: PersonFilterInput!) {
      people(filter: $filter, first: 5) {
        edges { node { id } }
      }
    }
  `;
  try {
    const data  = await graphqlRequest(query, {
      filter: {
        and: [
          { name: { firstName: { eq: firstName } } },
          { name: { lastName:  { eq: lastName  } } },
        ],
      },
    });
    const edges = data?.people?.edges || [];
    if (edges.length === 1) return edges[0].node.id;
  } catch (_) {}
  return null;
}

// ─── Mise à jour via GraphQL mutation ────────────────────────────────────────

async function patchPerson(personId, payload) {
  const fields = [];

  if (payload.genre) {
    fields.push(`genre: ${payload.genre}`);
  }
  if (payload.emails?.primaryEmail) {
    fields.push(`emails: { primaryEmail: ${JSON.stringify(payload.emails.primaryEmail)} }`);
  }
  if (payload.phones?.primaryPhoneNumber) {
    fields.push(`phones: { primaryPhoneNumber: ${JSON.stringify(payload.phones.primaryPhoneNumber)}, primaryPhoneCallingCode: "+33" }`);
  }

  if (fields.length === 0) return;

  const mutation = `mutation {
    updatePerson(id: "${personId}", data: {
      ${fields.join('\n      ')}
    }) { id }
  }`;

  await graphqlRequest(mutation);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Mise à jour genre + email contacts — TWENTY CRM');
  console.log('Fichier :', EXCEL_FILE);
  console.log('Onglets :', SHEETS.join(', '));
  if (DRY_RUN) console.log('Mode    : DRY RUN — aucune écriture');
  if (LIMIT)   console.log('Limite  :', LIMIT);
  console.log('');

  // 1. Lire Excel
  console.log('Lecture Excel...');
  const contactMap = buildContactMap(EXCEL_FILE, SHEETS);
  console.log(`${contactMap.size} contacts uniques avec genre ou email à traiter\n`);

  // 2. Récupérer les contacts sans email / sans téléphone dans Twenty
  const noEmailIds = await fetchPersonIdsWithout('email',     { emails: { primaryEmail: { eq: '' } } });
  const noPhoneIds = await fetchPersonIdsWithout('téléphone', { phones: { primaryPhoneNumber: { eq: '' } } });
  console.log('');

  const entries    = LIMIT ? [...contactMap.entries()].slice(0, LIMIT) : [...contactMap.entries()];
  const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportFile = path.join(__dirname, `update_genre_contacts_rapport_${timestamp}.json`);

  const stats = {
    total          : entries.length,
    genre_updated  : 0,
    email_updated  : 0,
    phone_updated  : 0,
    notFound       : 0,
    errors         : 0,
  };
  const notFoundList = [];
  const errorList    = [];

  // 3. Boucle principale
  for (let i = 0; i < entries.length; i++) {
    const [, { numeroSociete, contact, genre, email, telephone }] = entries[i];

    try {
      // Lookup cache puis fallback GraphQL
      let personId = mappings.getPerson(numeroSociete, contact);
      if (!personId) {
        personId = await findPersonByName(contact);
        if (personId) mappings.savePerson(numeroSociete, contact, personId);
      }

      if (!personId) {
        stats.notFound++;
        notFoundList.push(`${numeroSociete}|${contact}`);
        continue;
      }

      // Construire le payload (genre + email si manquant dans Twenty)
      const payload = {};

      if (genre) {
        payload.genre = genre;
      }

      if (email && noEmailIds.has(personId)) {
        payload.emails = { primaryEmail: email };
      }

      if (telephone && noPhoneIds.has(personId)) {
        payload.phones = { primaryPhoneNumber: telephone, primaryPhoneCallingCode: '+33' };
      }

      if (Object.keys(payload).length === 0) continue;

      if (!DRY_RUN) {
        await patchPerson(personId, payload);
      }

      if (payload.genre)  stats.genre_updated++;
      if (payload.emails) stats.email_updated++;
      if (payload.phones) stats.phone_updated++;

    } catch (err) {
      stats.errors++;
      errorList.push({ contact, error: String(err.message || err).substring(0, 150) });
    }

    // Progression + rapport intermédiaire tous les 20 items
    if ((i + 1) % 20 === 0 || i + 1 === entries.length) {
      console.log(
        `  ${i + 1}/${entries.length}` +
        ` | genre:${stats.genre_updated}` +
        ` | email:${stats.email_updated}` +
        ` | tel:${stats.phone_updated}` +
        ` | nf:${stats.notFound}` +
        ` | err:${stats.errors}`
      );
      // Écriture du rapport intermédiaire
      fs.writeFileSync(reportFile, JSON.stringify({
        date      : new Date().toISOString(),
        fichier   : EXCEL_FILE,
        onglets   : SHEETS,
        dry_run   : DRY_RUN,
        progress  : `${i + 1}/${entries.length}`,
        stats,
        not_found : notFoundList,
        errors    : errorList,
      }, null, 2), 'utf8');
    }
  }

  // 4. Résumé
  console.log('\n' + '='.repeat(60));
  console.log('MISE A JOUR TERMINEE\n');
  console.log(`Contacts traités    : ${stats.total}`);
  console.log(`Genre mis à jour    : ${stats.genre_updated}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Email importé       : ${stats.email_updated}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Téléphone importé   : ${stats.phone_updated}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Introuvables        : ${stats.notFound}`);
  console.log(`Erreurs             : ${stats.errors}`);

  if (notFoundList.length > 0) {
    console.log(`\nIntrouvables (${notFoundList.length}) :`);
    notFoundList.forEach(k => console.log(`  ${k}`));
  }

  if (errorList.length > 0) {
    console.log(`\nErreurs (${errorList.length}) :`);
    errorList.slice(0, 10).forEach(e => console.log(`  ${e.contact} → ${e.error}`));
    if (errorList.length > 10) console.log(`  ... et ${errorList.length - 10} autres`);
  }

  // Export rapport final JSON
  const report = {
    date         : new Date().toISOString(),
    fichier      : EXCEL_FILE,
    onglets      : SHEETS,
    dry_run      : DRY_RUN,
    stats,
    not_found    : notFoundList,
    errors       : errorList,
  };
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nRapport exporté : ${reportFile}`);

  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
