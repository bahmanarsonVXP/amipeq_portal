#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const XLSX = require('xlsx');

const { graphqlRequest } = require('./lib/core/http');

const args = minimist(process.argv.slice(2), {
  boolean: ['apply', 'use-proposed'],
});

const INPUT_PATH = args.input ? path.resolve(args.input) : null;
const APPLY = Boolean(args.apply);
const USE_PROPOSED = Boolean(args['use-proposed']);
const LIMIT = args.limit ? Number(args.limit) : null;

function formatTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function loadRows(filePath) {
  const workbook = XLSX.readFile(filePath, { raw: false });
  const sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: '',
    raw: false,
  });
}

function isTruthy(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['yes', 'y', 'true', '1', 'oui', 'ok', 'apply'].includes(normalized);
}

function buildPatch(row) {
  const patch = {};

  const typeClientValue = USE_PROPOSED ? row.proposedTypeClient : row.finalTypeClient;
  const sousTypeValue = USE_PROPOSED ? row.proposedSousType : row.finalSousType;
  const departementValue = USE_PROPOSED ? row.proposedDepartement : row.finalDepartement;
  const departementNumeroValue = USE_PROPOSED ? row.proposedDepartementNumero : row.finalDepartementNumero;

  if (isTruthy(row.missing_typeClient) && typeClientValue) {
    patch.typeClient = String(typeClientValue).trim();
  }
  if (isTruthy(row.missing_sousType) && sousTypeValue) {
    patch.sousType = String(sousTypeValue).trim();
  }
  if (!USE_PROPOSED && isTruthy(row.missing_departement) && departementValue) {
    patch.departement = String(departementValue).trim();
  }
  if (!USE_PROPOSED && isTruthy(row.missing_departementNumero) && departementNumeroValue) {
    patch.departementNumero = String(departementNumeroValue).trim();
  }

  return patch;
}

function listCandidates(rows) {
  const filtered = rows
    .filter((row) => USE_PROPOSED || isTruthy(row.applyRow))
    .map((row) => ({
      row,
      patch: buildPatch(row),
    }))
    .filter(({ row, patch }) => row.companyId && Object.keys(patch).length > 0);

  return LIMIT ? filtered.slice(0, LIMIT) : filtered;
}

async function applyPatch(companyId, patch) {
  const mutation = `
    mutation ApplyFillMissingReview($id: ID!, $data: CompanyUpdateInput!) {
      updateCompany(id: $id, data: $data) {
        id
        name
        numeroSociete
        typeClient
        sousType
        departement
        departementNumero
      }
    }
  `;

  const result = await graphqlRequest(mutation, {
    id: companyId,
    data: patch,
  });

  return result?.updateCompany || null;
}

async function main() {
  if (!INPUT_PATH) {
    console.error('Usage: node apply_fill_missing_review.js --input <csv|xlsx> [--apply] [--limit N]');
    process.exit(1);
  }

  const rows = loadRows(INPUT_PATH);
  const candidates = listCandidates(rows);

  console.log('=== APPLY FILL_MISSING REVIEW ===\n');
  console.log(`Fichier      : ${path.basename(INPUT_PATH)}`);
  console.log(`Candidats    : ${candidates.length}`);
  console.log(`Mode         : ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);
  if (USE_PROPOSED) {
    console.log('Source       : colonnes proposedTypeClient / proposedSousType\n');
  }

  if (!APPLY) {
    candidates.slice(0, 20).forEach(({ row, patch }, index) => {
      console.log(
        `${String(index + 1).padStart(2, ' ')}. ${row.numeroSociete || row.companyId} | ${row.name} | ${JSON.stringify(patch)}`
      );
    });
    if (candidates.length > 20) {
      console.log(`... et ${candidates.length - 20} autres`);
    }
    return;
  }

  const results = [];

  for (let index = 0; index < candidates.length; index++) {
    const { row, patch } = candidates[index];

    try {
      const after = await applyPatch(row.companyId, patch);
      results.push({
        companyId: row.companyId,
        numeroSociete: row.numeroSociete || null,
        name: row.name,
        status: 'updated',
        patch,
        after,
        reviewComment: row.reviewComment || '',
      });
      console.log(`  ${index + 1}/${candidates.length} OK  ${row.numeroSociete || row.companyId} ${row.name}`);
    } catch (error) {
      results.push({
        companyId: row.companyId,
        numeroSociete: row.numeroSociete || null,
        name: row.name,
        status: 'error',
        patch,
        error: error.message,
        reviewComment: row.reviewComment || '',
      });
      console.log(`  ${index + 1}/${candidates.length} ERR ${row.numeroSociete || row.companyId} ${error.message}`);
    }
  }

  const outputPath = path.join(
    path.dirname(INPUT_PATH),
    `apply_fill_missing_review_rapport_${formatTimestampForFile()}.json`
  );

  fs.writeFileSync(outputPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    sourceFile: path.basename(INPUT_PATH),
    apply: APPLY,
    summary: {
      total: results.length,
      updated: results.filter((entry) => entry.status === 'updated').length,
      errors: results.filter((entry) => entry.status === 'error').length,
    },
    results,
  }, null, 2));

  console.log('\n=== RESUME ===');
  console.log(`  Mises à jour: ${results.filter((entry) => entry.status === 'updated').length}`);
  console.log(`  Erreurs      : ${results.filter((entry) => entry.status === 'error').length}`);
  console.log(`  Rapport      : ${path.basename(outputPath)}`);
}

main().catch((error) => {
  console.error('\nERREUR APPLY FILL_MISSING:', error.message);
  process.exit(1);
});
