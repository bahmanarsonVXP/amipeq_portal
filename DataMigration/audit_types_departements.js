#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');

const { graphqlRequest } = require('./lib/core/http');
const { deriveCompanyFields } = require('./lib/core/company-derived');
const { getCompanySchema, getField, getSchemaSummary } = require('./lib/core/company-schema');
const { readOverridesFile, DEFAULT_OVERRIDES_PATH } = require('./lib/core/company-overrides');

const args = minimist(process.argv.slice(2));
const LIMIT = args.limit ? Number(args.limit) : null;
const PAGE_SIZE = args['page-size'] ? Number(args['page-size']) : 200;
const REPORT_PREFIX = args.report ? String(args.report) : null;

function isBlank(value) {
  return value === null || value === undefined || value === '';
}

function confidenceRank(value) {
  return value === 'high' ? 3 : value === 'medium' ? 2 : 1;
}

function formatTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function escapeCsv(value) {
  const str = String(value ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCompaniesQuery(schema) {
  const optionalFields = [
    getField(schema, 'typeClient') ? 'typeClient' : null,
    getField(schema, 'sousType') ? 'sousType' : null,
    getField(schema, 'departement') ? 'departement' : null,
    getField(schema, 'departementNumero') ? 'departementNumero' : null,
  ].filter(Boolean).join('\n            ');

  return `
    query AuditCompanies($after: String, $first: Int!) {
      companies(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
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
          }
        }
      }
    }
  `;
}

async function fetchCompanies(schema, limit = null) {
  const companies = [];
  let cursor = null;
  const query = buildCompaniesQuery(schema);

  do {
    const first = limit ? Math.min(PAGE_SIZE, limit - companies.length) : PAGE_SIZE;
    if (first <= 0) break;

    const data = await graphqlRequest(query, { after: cursor, first });
    const page = data?.companies;
    const edges = page?.edges || [];

    for (const edge of edges) {
      companies.push(edge.node);
      if (limit && companies.length >= limit) break;
    }

    cursor = page?.pageInfo?.hasNextPage && (!limit || companies.length < limit)
      ? page.pageInfo.endCursor
      : null;
  } while (cursor);

  return companies;
}

function pushDiff(diffs, patch, field, currentValue, derivedValue) {
  if (isBlank(derivedValue)) {
    diffs.push({ field, status: 'unresolved', current: currentValue ?? null, derived: null });
    return;
  }

  if (String(currentValue ?? '') === String(derivedValue ?? '')) {
    diffs.push({ field, status: 'unchanged', current: currentValue ?? null, derived: derivedValue });
    return;
  }

  if (isBlank(currentValue)) {
    diffs.push({ field, status: 'missing', current: currentValue ?? null, derived: derivedValue });
    patch[field] = derivedValue;
    return;
  }

  diffs.push({ field, status: 'mismatch', current: currentValue ?? null, derived: derivedValue });
  patch[field] = derivedValue;
}

function classifyAuditAction(record) {
  const statuses = record.fieldDiffs.map((diff) => diff.status);
  const hasMissing = statuses.includes('missing');
  const hasMismatch = statuses.includes('mismatch');
  const hasTypeChange = record.fieldDiffs.some(
    (diff) => ['typeClient', 'sousType'].includes(diff.field) && ['missing', 'mismatch'].includes(diff.status)
  );
  const hasDepartmentChange = record.fieldDiffs.some(
    (diff) => ['departement', 'departementNumero'].includes(diff.field) && ['missing', 'mismatch'].includes(diff.status)
  );

  if (!hasMissing && !hasMismatch && !record.needsAddressPostcodeNormalization) {
    return {
      action: 'keep',
      eligibleForAutofix: false,
      overallConfidence: record.classification.confidence,
    };
  }

  if (hasDepartmentChange && !record.departement.isValid) {
    return {
      action: 'invalid_postcode',
      eligibleForAutofix: false,
      overallConfidence: 'low',
    };
  }

  let overallConfidence = 'high';
  if (hasTypeChange && confidenceRank(record.classification.confidence) < confidenceRank(overallConfidence)) {
    overallConfidence = record.classification.confidence;
  }
  if (hasDepartmentChange && confidenceRank(overallConfidence) > 1) {
    overallConfidence = 'high';
  }

  if (hasMismatch && hasTypeChange && record.classification.confidence !== 'high') {
    return {
      action: 'manual_review',
      eligibleForAutofix: false,
      overallConfidence,
    };
  }

  return {
    action: hasMismatch ? 'update_mismatch' : 'fill_missing',
    eligibleForAutofix: overallConfidence === 'high',
    overallConfidence,
  };
}

function buildAuditRecord(company, derivation) {
  const patch = {};
  const fieldDiffs = [];
  const currentPostcode = company.address?.addressPostcode || null;
  const normalizedPostcode = derivation.derived.addressPostcode || null;

  pushDiff(fieldDiffs, patch, 'typeClient', company.typeClient, derivation.derived.typeClient);
  pushDiff(fieldDiffs, patch, 'sousType', company.sousType, derivation.derived.sousType);
  pushDiff(fieldDiffs, patch, 'departement', company.departement, derivation.derived.departement);
  pushDiff(fieldDiffs, patch, 'departementNumero', company.departementNumero, derivation.derived.departementNumero);

  const needsAddressPostcodeNormalization = Boolean(
    normalizedPostcode &&
    currentPostcode &&
    String(currentPostcode) !== String(normalizedPostcode)
  );

  const actionMeta = classifyAuditAction({
    fieldDiffs,
    classification: derivation.classification,
    departement: derivation.departement,
    needsAddressPostcodeNormalization,
  });

  if (needsAddressPostcodeNormalization) {
    patch.address = {
      addressStreet1: company.address?.addressStreet1 || null,
      addressCity: company.address?.addressCity || null,
      addressPostcode: normalizedPostcode,
      addressCountry: company.address?.addressCountry || 'France',
    };
  }

  return {
    companyId: company.id,
    numeroSociete: company.numeroSociete,
    name: company.name,
    current: {
      typeClient: company.typeClient ?? null,
      sousType: company.sousType ?? null,
      departement: company.departement ?? null,
      departementNumero: company.departementNumero ?? null,
      addressPostcode: currentPostcode,
    },
    derived: {
      typeClient: derivation.derived.typeClient,
      sousType: derivation.derived.sousType,
      departement: derivation.derived.departement,
      departementNumero: derivation.derived.departementNumero,
      addressPostcode: normalizedPostcode,
    },
    classification: derivation.classification,
    override: derivation.override
      ? {
          typeClient: derivation.override.typeClient || null,
          sousType: derivation.override.sousType || null,
          comment: derivation.override.comment || null,
        }
      : null,
    departement: {
      numero: derivation.departement.numero,
      code: derivation.departement.code,
      canonicalCode: derivation.departement.canonicalCode,
      isValid: derivation.departement.isValid,
      reason: derivation.departement.reason,
    },
    fieldDiffs,
    needsAddressPostcodeNormalization,
    proposedPatch: patch,
    action: actionMeta.action,
    eligibleForAutofix: actionMeta.eligibleForAutofix,
    overallConfidence: actionMeta.overallConfidence,
  };
}

function buildSummary(records) {
  return records.reduce((acc, record) => {
    acc.total++;
    acc.byAction[record.action] = (acc.byAction[record.action] || 0) + 1;
    if (record.eligibleForAutofix) acc.autofixable++;
    return acc;
  }, {
    total: 0,
    autofixable: 0,
    byAction: {},
  });
}

function toCsv(records) {
  const headers = [
    'companyId',
    'numeroSociete',
    'name',
    'action',
    'eligibleForAutofix',
    'overallConfidence',
    'currentTypeClient',
    'derivedTypeClient',
    'currentSousType',
    'derivedSousType',
    'currentDepartement',
    'derivedDepartement',
    'currentDepartementNumero',
    'derivedDepartementNumero',
    'currentAddressPostcode',
    'derivedAddressPostcode',
    'classificationRule',
    'classificationReason',
    'overrideApplied',
    'overrideTypeClient',
    'overrideSousType',
    'overrideComment',
    'departementReason',
  ];

  const rows = records.map((record) => [
    record.companyId,
    record.numeroSociete,
    record.name,
    record.action,
    record.eligibleForAutofix,
    record.overallConfidence,
    record.current.typeClient,
    record.derived.typeClient,
    record.current.sousType,
    record.derived.sousType,
    record.current.departement,
    record.derived.departement,
    record.current.departementNumero,
    record.derived.departementNumero,
    record.current.addressPostcode,
    record.derived.addressPostcode,
    record.classification.ruleId,
    record.classification.reason,
    Boolean(record.override),
    record.override?.typeClient,
    record.override?.sousType,
    record.override?.comment,
    record.departement.reason,
  ]);

  return [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');
}

async function main() {
  console.log('=== AUDIT TYPES ET DEPARTEMENTS ===\n');

  const schema = await getCompanySchema({ forceRefresh: true });
  const overrides = readOverridesFile(DEFAULT_OVERRIDES_PATH);
  const companies = await fetchCompanies(schema, LIMIT);

  console.log(`Companies analysées: ${companies.length}`);
  console.log('Introspection schema OK');

  const records = [];
  for (let index = 0; index < companies.length; index++) {
    const company = companies[index];
    const derivation = await deriveCompanyFields({
      name: company.name,
      cpRaw: company.address?.addressPostcode,
      numeroSociete: company.numeroSociete,
      companyId: company.id,
    }, { schema, overrides });

    records.push(buildAuditRecord(company, derivation));

    if ((index + 1) % 100 === 0 || index + 1 === companies.length) {
      console.log(`  ${index + 1}/${companies.length} sociétés analysées`);
    }
  }

  const summary = buildSummary(records);
  const timestamp = formatTimestampForFile();
  const baseName = REPORT_PREFIX || `audit_types_departements_rapport_${timestamp}`;
  const jsonPath = path.join(__dirname, `${baseName}.json`);
  const csvPath = path.join(__dirname, `${baseName}.csv`);

  const report = {
    createdAt: new Date().toISOString(),
    summary,
    schema: getSchemaSummary(schema),
    records,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(csvPath, `${toCsv(records)}\n`);

  console.log('\n=== RESUME ===');
  console.log(`  Total          : ${summary.total}`);
  console.log(`  Autofixables   : ${summary.autofixable}`);
  for (const [action, count] of Object.entries(summary.byAction)) {
    console.log(`  ${action.padEnd(15)} ${count}`);
  }
  console.log(`\nRapport JSON: ${path.basename(jsonPath)}`);
  console.log(`Rapport CSV : ${path.basename(csvPath)}`);
}

main().catch((error) => {
  console.error('\nERREUR AUDIT:', error.message);
  process.exit(1);
});
