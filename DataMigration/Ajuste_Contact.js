#!/usr/bin/env node
/**
 * Ajuste_Contact.js
 *
 * Corrige le lien contact des opportunites sans pointOfContactId.
 * Workflow:
 * - charge les opportunites avec pointOfContactId = NULL
 * - retrouve la ligne Excel selon annee + numeroDevis
 * - trouve la personne (mappings -> people par company -> email/nom)
 * - si absente: cree la personne puis lie l'opportunite
 *
 * Usage:
 *   node Ajuste_Contact.js --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx"
 *   node Ajuste_Contact.js --years "2026,2025,2024" --dry-run
 *   node Ajuste_Contact.js --years "2026" --limit 50
 */

const xlsx = require('xlsx');
const minimist = require('minimist');
const { graphqlRequest } = require('./lib/core/http');
const mappings = require('./lib/core/mappings');
const {
  buildPersonNameCandidates,
  normalizeComparableName,
  parseContactName,
} = require('./lib/parsers/contact-name');
const { normalizePhone } = require('./lib/parsers/phone');

const args = minimist(process.argv.slice(2));
const EXCEL_FILE = args.file || 'Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx';
const YEARS = args.years
  ? String(args.years).split(',').map((y) => y.trim()).filter(Boolean)
  : ['2026', '2025', '2024', '2023'];
const DRY_RUN = Boolean(args['dry-run']);
const LIMIT = args.limit ? parseInt(args.limit, 10) : null;

function splitEmails(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\/;,]/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

function buildExcelIndex(wb, years) {
  const byYear = {};
  for (const year of years) {
    if (!wb.SheetNames.includes(year)) continue;
    const ws = wb.Sheets[year];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    const map = new Map();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[2]) continue;
      const numeroDevis = String(row[7] || '').trim();
      if (!numeroDevis) continue;
      map.set(numeroDevis, {
        excelLine: i + 1,
        year,
        numeroSociete: String(Math.floor(Number(row[2]))),
        titre: String(row[4] || '').trim(),
        contact: String(row[5] || '').trim(),
        emailRaw: String(row[22] || '').trim(),
        emails: splitEmails(row[22]),
        telephone: normalizePhone(row[20]),
        ville: String(row[19] || '').trim(),
      });
    }
    byYear[year] = map;
  }
  return byYear;
}

async function getOpportunitiesWithoutContact(year) {
  const query = `
    query GetOppNoContact($filter: OpportunityFilterInput, $first: Int) {
      opportunities(filter: $filter, first: $first, orderBy: { createdAt: DescNullsLast }) {
        totalCount
        edges {
          node {
            id
            numeroDevis
            anneeDevis
            pointOfContactId
            company { id }
          }
        }
      }
    }
  `;

  const filter = {
    and: [
      { anneeDevis: { eq: Number(year) } },
      { pointOfContactId: { is: 'NULL' } },
    ],
  };
  const data = await graphqlRequest(query, { filter, first: 2000 });
  return data?.opportunities?.edges?.map((e) => e.node) || [];
}

async function getPeopleByCompany(companyId) {
  if (!companyId) return [];
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
    first: 500,
  });
  return data?.people?.edges?.map((e) => e.node) || [];
}

function findPersonInCompanyPeople(people, excelRow) {
  if (!people.length) return null;
  const excelEmails = new Set(excelRow.emails);

  if (excelEmails.size > 0) {
    for (const p of people) {
      const email = String(p.emails?.primaryEmail || '').trim().toLowerCase();
      if (email && excelEmails.has(email)) return p;
    }
  }

  const targetName = normalizeComparableName(excelRow.contact);
  if (targetName) {
    for (const p of people) {
      const candidates = buildPersonNameCandidates(p);
      if (candidates.includes(targetName)) return p;
    }
  }

  return null;
}

function parseTitre(titre) {
  if (!titre) return null;
  const t = String(titre).trim().toLowerCase().replace(/\.$/, '');
  if (t === 'm' || t === 'mr' || t === 'monsieur') return 'MONSSIEUR';
  if (t === 'mme' || t === 'madame')               return 'MADAME';
  if (t === 'mlle' || t === 'mademoiselle')         return 'MADEMOISELLE';
  return null;
}

async function createPersonForOpportunity(companyId, excelRow) {
  const { firstName, lastName } = parseContactName(excelRow.contact);
  const email = excelRow.emails[0] || null;
  const phone = excelRow.telephone && excelRow.telephone !== 'M.' ? excelRow.telephone : null;
  const genre = parseTitre(excelRow.titre);

  const optionalFields = [
    companyId ? `companyId: "${companyId}"` : null,
    email ? `emails: { primaryEmail: ${JSON.stringify(email)} }` : null,
    phone ? `phones: { primaryPhoneNumber: ${JSON.stringify(phone)}, primaryPhoneCallingCode: "+33" }` : null,
    excelRow.ville ? `city: ${JSON.stringify(excelRow.ville)}` : null,
    genre ? `genre: ${genre}` : null,
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

async function linkOpportunityToContact(opportunityId, personId) {
  const mutation = `
    mutation {
      updateOpportunity(id: "${opportunityId}", data: { pointOfContactId: "${personId}" }) {
        id
        pointOfContactId
      }
    }
  `;
  return graphqlRequest(mutation);
}

async function main() {
  console.log('Ajuste contact sur opportunites sans contact');
  console.log('Fichier :', EXCEL_FILE);
  console.log('Annees  :', YEARS.join(', '));
  if (DRY_RUN) console.log('Mode    : DRY RUN');
  if (LIMIT) console.log('Limite  :', LIMIT);
  console.log('');

  const wb = xlsx.readFile(EXCEL_FILE, { cellStyles: false });
  const index = buildExcelIndex(wb, YEARS);

  const stats = {
    scanned: 0,
    linkedExisting: 0,
    createdAndLinked: 0,
    skippedNoExcel: 0,
    skippedNoCompany: 0,
    skippedNoContactData: 0,
    errors: 0,
  };
  const details = [];

  let processed = 0;

  for (const year of YEARS) {
    const opps = await getOpportunitiesWithoutContact(year);
    for (const opp of opps) {
      if (LIMIT && processed >= LIMIT) break;
      processed++;
      stats.scanned++;

      try {
        if (!opp.company?.id) {
          stats.skippedNoCompany++;
          continue;
        }
        const excelRow = index[year]?.get(String(opp.numeroDevis || '').trim());
        if (!excelRow) {
          stats.skippedNoExcel++;
          continue;
        }
        if (!excelRow.contact && excelRow.emails.length === 0) {
          stats.skippedNoContactData++;
          continue;
        }

        let personId = mappings.getPerson(excelRow.numeroSociete, excelRow.contact);
        let from = 'mapping';

        if (!personId) {
          const people = await getPeopleByCompany(opp.company.id);
          const found = findPersonInCompanyPeople(people, excelRow);
          if (found?.id) {
            personId = found.id;
            mappings.savePerson(excelRow.numeroSociete, excelRow.contact, personId);
            from = 'people_lookup';
          }
        }

        if (!personId) {
          if (DRY_RUN) {
            stats.createdAndLinked++;
            details.push({
              type: 'would_create_and_link',
              numeroDevis: opp.numeroDevis,
              year,
              excelLine: excelRow.excelLine,
            });
            continue;
          }

          personId = await createPersonForOpportunity(opp.company.id, excelRow);
          if (!personId) throw new Error('createPerson sans id');
          mappings.savePerson(excelRow.numeroSociete, excelRow.contact, personId);
          await linkOpportunityToContact(opp.id, personId);
          stats.createdAndLinked++;
          continue;
        }

        if (!DRY_RUN) {
          await linkOpportunityToContact(opp.id, personId);
        }
        stats.linkedExisting++;
        details.push({
          type: DRY_RUN ? 'would_link_existing' : 'linked_existing',
          numeroDevis: opp.numeroDevis,
          personId,
          source: from,
          year,
          excelLine: excelRow.excelLine,
        });
      } catch (error) {
        stats.errors++;
        details.push({
          type: 'error',
          numeroDevis: opp.numeroDevis,
          year,
          error: String(error.message || error),
        });
      }

      if (processed % 20 === 0) {
        console.log(`${processed} | linked:${stats.linkedExisting} | created+linked:${stats.createdAndLinked} | err:${stats.errors}`);
      }
    }
    if (LIMIT && processed >= LIMIT) break;
  }

  console.log('\n' + '='.repeat(60));
  console.log('AJUSTE CONTACT TERMINE');
  console.log(`Scanned              : ${stats.scanned}`);
  console.log(`Linked existing      : ${stats.linkedExisting}`);
  console.log(`Created and linked   : ${stats.createdAndLinked}`);
  console.log(`Skipped (no excel)   : ${stats.skippedNoExcel}`);
  console.log(`Skipped (no company) : ${stats.skippedNoCompany}`);
  console.log(`Skipped (no contact) : ${stats.skippedNoContactData}`);
  console.log(`Errors               : ${stats.errors}`);
  if (DRY_RUN) console.log('Mode DRY RUN         : aucune ecriture');

  const errors = details.filter((d) => d.type === 'error');
  if (errors.length > 0) {
    console.log(`\nErreurs (${errors.length}):`);
    errors.slice(0, 15).forEach((e) => {
      console.log(`  ${e.year} ${e.numeroDevis} -> ${String(e.error).substring(0, 180)}`);
    });
    if (errors.length > 15) {
      console.log(`  ... et ${errors.length - 15} autres`);
    }
  }
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
