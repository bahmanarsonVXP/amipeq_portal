#!/usr/bin/env node
/**
 * fix_notfound_contacts.js
 *
 * Traite les contacts signalés "not_found" par update_genre_contacts.js.
 * Pour chaque entrée :
 *   1. Retrouve les données Excel (email, tel, titre, ville)
 *   2. Cherche la personne dans Twenty (cache → email → people de la société)
 *   3. Crée la personne si absente
 *   4. Lie la personne aux opportunités sans contact (pointOfContactId IS NULL) de la société
 *
 * Usage:
 *   node fix_notfound_contacts.js
 *   node fix_notfound_contacts.js --rapport "update_genre_contacts_rapport_2026-05-11T20-17-33.json"
 *   node fix_notfound_contacts.js --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx"
 *   node fix_notfound_contacts.js --dry-run
 *   node fix_notfound_contacts.js --limit 20
 */

const xlsx     = require('xlsx');
const minimist = require('minimist');
const fs       = require('fs');
const path     = require('path');
const { graphqlRequest } = require('./lib/core/http');
const mappings = require('./lib/core/mappings');
const { parseTitre } = require('./lib/entities/person');
const {
  buildPersonNameCandidates,
  normalizeComparableName,
  parseContactName,
} = require('./lib/parsers/contact-name');
const { normalizePhone } = require('./lib/parsers/phone');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args        = minimist(process.argv.slice(2));
const RAPPORT_FILE = args.rapport || 'update_genre_contacts_rapport_2026-05-11T20-17-33.json';
const EXCEL_FILE  = args.file    || 'Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx';
const SHEETS      = ['2023', '2024', '2025', '2026'];
const DRY_RUN     = Boolean(args['dry-run']);
const LIMIT       = args.limit ? parseInt(args.limit, 10) : null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function splitEmails(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\/;,]/)
    .map(e => e.trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

// ─── Lecture Excel ────────────────────────────────────────────────────────────
// Colonnes : C(2)=numeroSociete, E(4)=Titre, F(5)=Contact, T(19)=Ville, U(20)=Tel, W(22)=Email

function buildExcelMap(filePath, sheets) {
  const wb  = xlsx.readFile(filePath, { cellStyles: false });
  const map = new Map(); // key = "numeroSociete|contact"

  for (const sheet of sheets) {
    if (!wb.SheetNames.includes(sheet)) continue;
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '', raw: true });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[2]) continue;

      const numeroSociete = String(Math.floor(Number(row[2])));
      const contact       = String(row[5]  || '').trim();
      if (!contact) continue;

      const key = `${numeroSociete}|${contact}`;
      if (map.has(key)) continue; // première occurrence gagne

      const emailRaw  = String(row[22] || '').trim().toLowerCase();
      const email     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;
      const telephone = normalizePhone(row[20]);

      map.set(key, {
        numeroSociete,
        contact,
        titre   : String(row[4]  || '').trim(),
        email,
        emails  : splitEmails(row[22]),
        telephone,
        ville   : String(row[19] || '').trim(),
      });
    }
  }

  return map;
}

// ─── GraphQL helpers ──────────────────────────────────────────────────────────

async function findPersonByEmail(email) {
  if (!email) return null;
  const query = `
    query FindByEmail($filter: PersonFilterInput!) {
      people(filter: $filter, first: 5) {
        edges { node { id } }
      }
    }
  `;
  const data = await graphqlRequest(query, {
    filter: { emails: { primaryEmail: { eq: email } } },
  });
  const edges = data?.people?.edges || [];
  return edges.length >= 1 ? edges[0].node.id : null;
}

async function getPeopleByCompany(companyId) {
  const query = `
    query PeopleByCompany($filter: PersonFilterInput!, $first: Int) {
      people(filter: $filter, first: $first) {
        edges {
          node {
            id
            name { firstName lastName }
            emails { primaryEmail }
          }
        }
      }
    }
  `;
  const data = await graphqlRequest(query, {
    filter: { companyId: { eq: companyId } },
    first : 500,
  });
  return data?.people?.edges?.map(e => e.node) || [];
}

function findPersonByName(people, contactName) {
  const target = normalizeComparableName(contactName);
  if (!target) return null;
  for (const p of people) {
    const candidates = buildPersonNameCandidates(p);
    if (candidates.includes(target)) return p;
  }
  return null;
}

async function createPerson(companyId, row) {
  const { firstName, lastName } = parseContactName(row.contact);
  const genre     = parseTitre(row.titre);
  const email     = row.emails[0] || null;
  const phone     = row.telephone;

  const optionalFields = [
    companyId ? `companyId: "${companyId}"` : null,
    email     ? `emails: { primaryEmail: ${JSON.stringify(email)} }` : null,
    phone     ? `phones: { primaryPhoneNumber: ${JSON.stringify(phone)}, primaryPhoneCallingCode: "+33" }` : null,
    row.ville ? `city: ${JSON.stringify(row.ville)}` : null,
    genre     ? `genre: ${genre}` : null,
  ].filter(Boolean).join('\n      ');

  const mutation = `
    mutation {
      createPerson(data: {
        name: { firstName: ${JSON.stringify(firstName)}, lastName: ${JSON.stringify(lastName)} }
        ${optionalFields}
      }) { id }
    }
  `;
  const data = await graphqlRequest(mutation);
  return data?.createPerson?.id || null;
}

async function getOpportunitiesWithoutContact(companyId) {
  const query = `
    query OppNoContact($filter: OpportunityFilterInput!, $first: Int) {
      opportunities(filter: $filter, first: $first) {
        edges { node { id numeroDevis } }
      }
    }
  `;
  const data = await graphqlRequest(query, {
    filter: {
      and: [
        { companyId       : { eq  : companyId } },
        { pointOfContactId: { is  : 'NULL'    } },
      ],
    },
    first: 500,
  });
  return data?.opportunities?.edges?.map(e => e.node) || [];
}

async function linkOpportunity(opportunityId, personId) {
  const mutation = `
    mutation {
      updateOpportunity(id: "${opportunityId}", data: { pointOfContactId: "${personId}" }) {
        id
      }
    }
  `;
  return graphqlRequest(mutation);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fix not-found contacts — TWENTY CRM');
  console.log('Rapport :', RAPPORT_FILE);
  console.log('Excel   :', EXCEL_FILE);
  if (DRY_RUN) console.log('Mode    : DRY RUN — aucune écriture');
  if (LIMIT)   console.log('Limite  :', LIMIT);
  console.log('');

  // 1. Lire le rapport JSON
  const rapport    = JSON.parse(fs.readFileSync(RAPPORT_FILE, 'utf8'));
  const notFound   = rapport.not_found || [];
  console.log(`${notFound.length} contacts not_found dans le rapport\n`);

  // 2. Construire l'index Excel
  console.log('Lecture Excel...');
  const excelMap   = buildExcelMap(EXCEL_FILE, SHEETS);
  console.log(`${excelMap.size} entrées uniques dans l'Excel\n`);

  const entries    = LIMIT ? notFound.slice(0, LIMIT) : notFound;
  const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportFile = path.join(__dirname, `fix_notfound_rapport_${timestamp}.json`);

  const stats = {
    total           : entries.length,
    foundExisting   : 0,
    created         : 0,
    oppsLinked      : 0,
    skippedNoExcel  : 0,
    skippedNoCompany: 0,
    errors          : 0,
  };
  const details    = [];

  // 3. Boucle principale
  for (let i = 0; i < entries.length; i++) {
    const key              = entries[i];
    const [numeroSociete, ...contactParts] = key.split('|');
    const contact          = contactParts.join('|'); // handle pipes in name (rare)

    try {
      // a. Données Excel ?
      const row = excelMap.get(key);
      if (!row) {
        stats.skippedNoExcel++;
        details.push({ key, result: 'skipped_no_excel' });
        continue;
      }

      // b. Société dans mappings ?
      const companyId = mappings.getCompany(numeroSociete);
      if (!companyId) {
        stats.skippedNoCompany++;
        details.push({ key, result: 'skipped_no_company', numeroSociete });
        continue;
      }

      // c. Chercher personne existante dans Twenty
      let personId = mappings.getPerson(numeroSociete, contact);
      let source   = 'cache';

      if (!personId && row.email) {
        personId = await findPersonByEmail(row.email);
        if (personId) source = 'email_lookup';
      }

      if (!personId) {
        const people = await getPeopleByCompany(companyId);
        const found  = findPersonByName(people, contact);
        if (found) {
          personId = found.id;
          source   = 'name_lookup';
        }
      }

      if (personId) {
        // Sauvegarder dans le cache si trouvé via lookup
        if (source !== 'cache') {
          mappings.savePerson(numeroSociete, contact, personId);
        }
        stats.foundExisting++;
        details.push({ key, result: DRY_RUN ? 'would_use_existing' : 'used_existing', source, personId });
      } else {
        // d. Créer la personne
        if (DRY_RUN) {
          stats.created++;
          details.push({ key, result: 'would_create', companyId, email: row.email, tel: row.telephone });
          continue; // pas d'opps à lier en dry-run sans personId réel
        }

        personId = await createPerson(companyId, row);
        if (!personId) throw new Error('createPerson sans id');
        mappings.savePerson(numeroSociete, contact, personId);
        stats.created++;
        details.push({ key, result: 'created', personId, companyId });
      }

      // e. Lier aux opportunités sans contact
      const opps = await getOpportunitiesWithoutContact(companyId);
      let linked = 0;
      for (const opp of opps) {
        if (!DRY_RUN) {
          await linkOpportunity(opp.id, personId);
        }
        linked++;
      }
      stats.oppsLinked += linked;
      if (linked > 0) {
        details[details.length - 1].oppsLinked = linked;
      }

    } catch (err) {
      stats.errors++;
      details.push({ key, result: 'error', error: String(err.message || err).substring(0, 200) });
    }

    // Progression + rapport intermédiaire tous les 10 items
    if ((i + 1) % 10 === 0 || i + 1 === entries.length) {
      console.log(
        `  ${i + 1}/${entries.length}` +
        ` | found:${stats.foundExisting}` +
        ` | created:${stats.created}` +
        ` | opps:${stats.oppsLinked}` +
        ` | skip_excel:${stats.skippedNoExcel}` +
        ` | skip_co:${stats.skippedNoCompany}` +
        ` | err:${stats.errors}`
      );
      fs.writeFileSync(reportFile, JSON.stringify({
        date     : new Date().toISOString(),
        dry_run  : DRY_RUN,
        progress : `${i + 1}/${entries.length}`,
        stats,
        details,
      }, null, 2), 'utf8');
    }
  }

  // 4. Résumé final
  console.log('\n' + '='.repeat(60));
  console.log('FIX NOT-FOUND TERMINE\n');
  console.log(`Traités              : ${stats.total}`);
  console.log(`Trouvés (existants)  : ${stats.foundExisting}`);
  console.log(`Créés                : ${stats.created}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Opportunités liées   : ${stats.oppsLinked}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Ignorés (sans Excel) : ${stats.skippedNoExcel}`);
  console.log(`Ignorés (sans sté)   : ${stats.skippedNoCompany}`);
  console.log(`Erreurs              : ${stats.errors}`);

  const errors = details.filter(d => d.result === 'error');
  if (errors.length > 0) {
    console.log(`\nErreurs (${errors.length}):`);
    errors.slice(0, 15).forEach(e => console.log(`  ${e.key} → ${e.error}`));
    if (errors.length > 15) console.log(`  ... et ${errors.length - 15} autres`);
  }

  console.log(`\nRapport : ${reportFile}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
