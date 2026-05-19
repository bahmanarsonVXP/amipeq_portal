#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');

const { graphqlRequest } = require('./lib/core/http');

const args = minimist(process.argv.slice(2), {
  boolean: ['apply', 'include-medium'],
});

const REPORT_PATH = args.report ? path.resolve(args.report) : null;
const APPLY = Boolean(args.apply);
const INCLUDE_MEDIUM = Boolean(args['include-medium']);
const LIMIT = args.limit ? Number(args.limit) : null;
const COMPANY_ID = args.companyId ? String(args.companyId) : null;

function formatTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function readReport(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function buildSelectionFields(schemaSummary) {
  const optionalFields = [
    schemaSummary?.typeClient?.exists ? 'typeClient' : null,
    schemaSummary?.sousType?.exists ? 'sousType' : null,
    schemaSummary?.departement?.exists ? 'departement' : null,
    schemaSummary?.departementNumero?.exists ? 'departementNumero' : null,
  ].filter(Boolean).join('\n        ');

  return `
    id
    name
    numeroSociete
    ${optionalFields}
    address {
      addressStreet1
      addressCity
      addressPostcode
      addressCountry
    }
  `;
}

function shouldApplyRecord(record) {
  if (!['fill_missing', 'update_mismatch'].includes(record.action)) return false;
  if (COMPANY_ID && record.companyId !== COMPANY_ID) return false;

  if (record.eligibleForAutofix) return true;
  if (INCLUDE_MEDIUM && record.overallConfidence === 'medium') return true;

  return false;
}

function listCandidates(records) {
  const candidates = records.filter(shouldApplyRecord);
  return LIMIT ? candidates.slice(0, LIMIT) : candidates;
}

async function applyRecord(record, selectionFields) {
  const mutation = `
    mutation UpdateCompanyFromAudit($id: ID!, $data: CompanyUpdateInput!) {
      updateCompany(id: $id, data: $data) {
        ${selectionFields}
      }
    }
  `;

  const result = await graphqlRequest(mutation, {
    id: record.companyId,
    data: record.proposedPatch,
  });

  return result?.updateCompany || null;
}

async function main() {
  if (!REPORT_PATH) {
    console.error('Usage: node backfill_types_departements.js --report <rapport.json> [--apply] [--include-medium] [--limit N]');
    process.exit(1);
  }

  const report = readReport(REPORT_PATH);
  const records = report.records || [];
  const candidates = listCandidates(records);

  console.log('=== BACKFILL TYPES ET DEPARTEMENTS ===\n');
  console.log(`Rapport      : ${path.basename(REPORT_PATH)}`);
  console.log(`Candidats    : ${candidates.length}`);
  console.log(`Mode         : ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Medium       : ${INCLUDE_MEDIUM ? 'oui' : 'non'}\n`);

  if (!APPLY) {
    candidates.slice(0, 20).forEach((record, index) => {
      console.log(
        `${String(index + 1).padStart(2, ' ')}. ${record.numeroSociete || 'N/A'} | ${record.name} | ${record.action} | ${record.overallConfidence}`
      );
    });
    if (candidates.length > 20) {
      console.log(`... et ${candidates.length - 20} autres`);
    }
    return;
  }

  const selectionFields = buildSelectionFields(report.schema || {});
  const results = [];

  for (let index = 0; index < candidates.length; index++) {
    const record = candidates[index];

    try {
      const after = await applyRecord(record, selectionFields);
      results.push({
        companyId: record.companyId,
        numeroSociete: record.numeroSociete,
        name: record.name,
        status: 'updated',
        action: record.action,
        before: record.current,
        patch: record.proposedPatch,
        after,
      });
      console.log(`  ${index + 1}/${candidates.length} OK  ${record.numeroSociete || record.companyId} ${record.name}`);
    } catch (error) {
      results.push({
        companyId: record.companyId,
        numeroSociete: record.numeroSociete,
        name: record.name,
        status: 'error',
        action: record.action,
        before: record.current,
        patch: record.proposedPatch,
        error: error.message,
      });
      console.log(`  ${index + 1}/${candidates.length} ERR ${record.numeroSociete || record.companyId} ${error.message}`);
    }
  }

  const outputPath = path.join(
    __dirname,
    `backfill_types_departements_rapport_${formatTimestampForFile()}.json`
  );

  fs.writeFileSync(outputPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    sourceReport: path.basename(REPORT_PATH),
    apply: APPLY,
    includeMedium: INCLUDE_MEDIUM,
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
  console.error('\nERREUR BACKFILL:', error.message);
  process.exit(1);
});
