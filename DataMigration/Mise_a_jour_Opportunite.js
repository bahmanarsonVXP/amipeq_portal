#!/usr/bin/env node
/**
 * Mise_a_jour_Opportunite.js
 *
 * Met a jour les opportunites existantes depuis un onglet Excel.
 * Pour chaque ligne:
 * - trouve l'opportunite via numeroDevis
 * - compare les champs metier
 * - met a jour uniquement si des differences existent
 *
 * Usage:
 *   node Mise_a_jour_Opportunite.js --sheet 2026
 *   node Mise_a_jour_Opportunite.js --sheet 2026 --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx"
 *   node Mise_a_jour_Opportunite.js --sheet 2026 --dry-run
 *   node Mise_a_jour_Opportunite.js --sheet 2026 --limit 50
 */

const xlsx = require('xlsx');
const minimist = require('minimist');
const { graphqlRequest } = require('./lib/core/http');
const { parseExcelDate } = require('./lib/parsers/excel');
const { parseNorme } = require('./lib/parsers/norme');
const { OPP } = require('./lib/core/opportunity-stages');

const args = minimist(process.argv.slice(2));
const SHEET = args.sheet ? String(args.sheet) : null;
const EXCEL_FILE = args.file || 'Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx';
const DRY_RUN = Boolean(args['dry-run']);
const LIMIT = args.limit ? parseInt(args.limit, 10) : null;

if (!SHEET) {
  console.error('Erreur: argument --sheet obligatoire (ex: --sheet 2026)');
  process.exit(1);
}

function parseStatutY(val) {
  if (!val && val !== 0) return null;
  const v = String(val).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (v === 'gagne') return { stage: OPP.WON, statutDevis: 'GAGNE' };
  if (v === 'perdu') return { stage: OPP.LOST, statutDevis: 'PERDU' };
  if (v.includes('devis')) return { stage: OPP.CLIENT_PENDING, statutDevis: 'EN_ATTENTE' };
  return null;
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseEmails(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\/;,]/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeIsoDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildRowData(data) {
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[2]) continue;
    const numeroDevis = String(row[7] || '').trim();
    if (!numeroDevis) continue;

    const statut = parseStatutY(row[24]);
    const offre1 = toNumberOrNull(row[9]);
    const offre2 = toNumberOrNull(row[10]);
    const montantPrincipal = offre2 ?? offre1;

    let tauxRemise = null;
    let montantRemiseMicros = null;
    if (offre1 && offre2 && offre1 > 0) {
      tauxRemise = Math.round((1 - offre2 / offre1) * 100);
      montantRemiseMicros = Math.round((offre1 - offre2) * 1_000_000);
    }

    rows.push({
      excelLine: i + 1,
      sheet: SHEET,
      numeroSociete: String(Math.floor(Number(row[2]))),
      numeroDevis,
      contact: String(row[5] || '').trim(),
      emails: parseEmails(row[22]),
      dateDevisIso: parseExcelDate(row[8] || row[1] || '', SHEET),
      dateDevisDay: normalizeIsoDate(parseExcelDate(row[8] || row[1] || '', SHEET)),
      stage: statut?.stage || null,
      statutDevis: statut?.statutDevis || null,
      prestation: parseNorme(String(row[11] || '').trim()),
      normeOriginale: String(row[11] || '').trim() || null,
      amountMicros: montantPrincipal != null ? Math.round(montantPrincipal * 1_000_000) : null,
      tauxRemise,
      montantRemiseMicros,
    });
  }
  return LIMIT ? rows.slice(0, LIMIT) : rows;
}

async function getOpportunityByNumeroDevis(numeroDevis) {
  const query = `
    query GetOpp($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter, first: 1) {
        totalCount
        edges {
          node {
            id
            numeroDevis
            stage
            statutDevis
            dateDevis
            prestation
            normeOriginale
            tauxRemise
            amount { amountMicros currencyCode }
            montantRemise { amountMicros currencyCode }
          }
        }
      }
    }
  `;

  const data = await graphqlRequest(query, {
    filter: { numeroDevis: { eq: numeroDevis } },
  });
  const total = data?.opportunities?.totalCount || 0;
  const node = data?.opportunities?.edges?.[0]?.node || null;
  return { total, node };
}

function enumArrayToGraphql(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return `[${values.join(', ')}]`;
}

function buildUpdateDataParts(current, target) {
  const parts = [];
  const changes = [];

  if (target.stage && current.stage !== target.stage) {
    parts.push(`stage: ${target.stage}`);
    changes.push('stage');
  }

  if (target.statutDevis && current.statutDevis !== target.statutDevis) {
    parts.push(`statutDevis: ${target.statutDevis}`);
    changes.push('statutDevis');
  }

  const currDate = normalizeIsoDate(current.dateDevis);
  if (target.dateDevisIso && currDate !== target.dateDevisDay) {
    parts.push(`dateDevis: "${target.dateDevisIso}"`);
    changes.push('dateDevis');
  }

  const currAmountMicros =
    typeof current.amount?.amountMicros === 'string'
      ? parseInt(current.amount.amountMicros, 10)
      : (current.amount?.amountMicros ?? null);
  if (target.amountMicros !== currAmountMicros) {
    if (target.amountMicros == null) {
      parts.push('amount: null');
    } else {
      parts.push(`amount: { amountMicros: ${target.amountMicros}, currencyCode: EUR }`);
    }
    changes.push('amount');
  }

  if ((current.tauxRemise ?? null) !== (target.tauxRemise ?? null)) {
    parts.push(target.tauxRemise == null ? 'tauxRemise: null' : `tauxRemise: ${target.tauxRemise}`);
    changes.push('tauxRemise');
  }

  const currRemiseMicros =
    typeof current.montantRemise?.amountMicros === 'string'
      ? parseInt(current.montantRemise.amountMicros, 10)
      : (current.montantRemise?.amountMicros ?? null);
  if ((target.montantRemiseMicros ?? null) !== (currRemiseMicros ?? null)) {
    if (target.montantRemiseMicros == null) {
      parts.push('montantRemise: null');
    } else {
      parts.push(`montantRemise: { amountMicros: ${target.montantRemiseMicros}, currencyCode: EUR }`);
    }
    changes.push('montantRemise');
  }

  const currNorme = current.normeOriginale || null;
  if ((target.normeOriginale || null) !== currNorme) {
    if (target.normeOriginale) {
      parts.push(`normeOriginale: ${JSON.stringify(target.normeOriginale)}`);
    } else {
      parts.push('normeOriginale: null');
    }
    changes.push('normeOriginale');
  }

  const currPrest = Array.isArray(current.prestation) ? current.prestation : [];
  const samePrest = currPrest.length === target.prestation.length &&
    currPrest.every((p, idx) => p === target.prestation[idx]);
  if (!samePrest) {
    const gqlArray = enumArrayToGraphql(target.prestation);
    parts.push(gqlArray ? `prestation: ${gqlArray}` : 'prestation: []');
    changes.push('prestation');
  }

  return { parts, changes };
}

async function updateOpportunity(oppId, dataParts) {
  const mutation = `
    mutation {
      updateOpportunity(id: "${oppId}", data: {
        ${dataParts.join('\n        ')}
      }) { id }
    }
  `;
  return graphqlRequest(mutation);
}

async function main() {
  console.log('Mise a jour opportunites depuis Excel');
  console.log('Fichier :', EXCEL_FILE);
  console.log('Onglet  :', SHEET);
  if (DRY_RUN) console.log('Mode    : DRY RUN');
  if (LIMIT) console.log('Limite  :', LIMIT);
  console.log('');

  const wb = xlsx.readFile(EXCEL_FILE, { cellStyles: true });
  if (!wb.SheetNames.includes(SHEET)) {
    console.error(`Erreur: onglet "${SHEET}" introuvable`);
    process.exit(1);
  }

  const ws = wb.Sheets[SHEET];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  const rows = buildRowData(data);

  const stats = {
    checked: 0,
    notFound: 0,
    unchanged: 0,
    updated: 0,
    errors: 0,
    changedFields: {},
  };

  const errorDetails = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const found = await getOpportunityByNumeroDevis(row.numeroDevis);
      stats.checked++;

      if (!found.node) {
        stats.notFound++;
        continue;
      }

      const { parts, changes } = buildUpdateDataParts(found.node, row);
      if (parts.length === 0) {
        stats.unchanged++;
      } else {
        for (const field of changes) {
          stats.changedFields[field] = (stats.changedFields[field] || 0) + 1;
        }
        if (!DRY_RUN) {
          await updateOpportunity(found.node.id, parts);
        }
        stats.updated++;
      }
    } catch (error) {
      stats.errors++;
      errorDetails.push({
        line: row.excelLine,
        numeroDevis: row.numeroDevis,
        error: String(error.message || error),
      });
    }

    if ((i + 1) % 20 === 0 || i + 1 === rows.length) {
      console.log(`${i + 1}/${rows.length} | maj:${stats.updated} | ok:${stats.unchanged} | nf:${stats.notFound} | err:${stats.errors}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('MISE A JOUR TERMINEE');
  console.log(`Lignes traitees: ${rows.length}`);
  console.log(`Checked        : ${stats.checked}`);
  console.log(`Updated        : ${stats.updated}`);
  console.log(`Unchanged      : ${stats.unchanged}`);
  console.log(`Not found      : ${stats.notFound}`);
  console.log(`Errors         : ${stats.errors}`);
  if (DRY_RUN) console.log('Mode DRY RUN   : aucune ecriture');

  const changedKeys = Object.keys(stats.changedFields);
  if (changedKeys.length > 0) {
    console.log('\nChamps modifies:');
    for (const key of changedKeys) {
      console.log(`  ${key}: ${stats.changedFields[key]}`);
    }
  }

  if (errorDetails.length > 0) {
    console.log(`\nErreurs (${errorDetails.length}):`);
    errorDetails.slice(0, 15).forEach((e) => {
      console.log(`  L${e.line} ${e.numeroDevis} -> ${e.error.substring(0, 180)}`);
    });
    if (errorDetails.length > 15) {
      console.log(`  ... et ${errorDetails.length - 15} autres`);
    }
  }
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
