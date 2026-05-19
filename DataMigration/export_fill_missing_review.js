#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const XLSX = require('xlsx');

const args = minimist(process.argv.slice(2));
const REPORT_PATH = args.report ? path.resolve(args.report) : null;
const OUTPUT_BASENAME = args.output
  ? path.resolve(args.output)
  : null;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function normalizeBasename(filePath) {
  const parsed = path.parse(filePath);
  return parsed.name.replace(/^audit_types_departements_/, 'fill_missing_review_');
}

function yesNo(value) {
  return value ? 'YES' : 'NO';
}

function getDiffStatus(record, field) {
  return record.fieldDiffs.find((diff) => diff.field === field)?.status || '';
}

function buildMissingFields(record) {
  return record.fieldDiffs
    .filter((diff) => diff.status === 'missing')
    .map((diff) => diff.field)
    .join('|');
}

function buildRows(report) {
  return (report.records || [])
    .filter((record) => record.action === 'fill_missing')
    .map((record) => ({
      companyId: record.companyId,
      numeroSociete: record.numeroSociete ?? '',
      name: record.name,
      action: record.action,
      overallConfidence: record.overallConfidence,
      applyRow: 'YES',
      missingFields: buildMissingFields(record),
      missing_typeClient: yesNo(getDiffStatus(record, 'typeClient') === 'missing'),
      missing_sousType: yesNo(getDiffStatus(record, 'sousType') === 'missing'),
      missing_departement: yesNo(getDiffStatus(record, 'departement') === 'missing'),
      missing_departementNumero: yesNo(getDiffStatus(record, 'departementNumero') === 'missing'),
      currentTypeClient: record.current?.typeClient ?? '',
      currentSousType: record.current?.sousType ?? '',
      currentDepartement: record.current?.departement ?? '',
      currentDepartementNumero: record.current?.departementNumero ?? '',
      currentAddressPostcode: record.current?.addressPostcode ?? '',
      proposedTypeClient: record.derived?.typeClient ?? '',
      proposedSousType: record.derived?.sousType ?? '',
      proposedDepartement: record.derived?.departement ?? '',
      proposedDepartementNumero: record.derived?.departementNumero ?? '',
      finalTypeClient: getDiffStatus(record, 'typeClient') === 'missing' ? (record.derived?.typeClient ?? '') : '',
      finalSousType: getDiffStatus(record, 'sousType') === 'missing' ? (record.derived?.sousType ?? '') : '',
      finalDepartement: getDiffStatus(record, 'departement') === 'missing' ? (record.derived?.departement ?? '') : '',
      finalDepartementNumero: getDiffStatus(record, 'departementNumero') === 'missing' ? (record.derived?.departementNumero ?? '') : '',
      reviewComment: '',
      classificationRule: record.classification?.ruleId ?? '',
      classificationReason: record.classification?.reason ?? '',
      departementReason: record.departement?.reason ?? '',
      proposedPatchJson: JSON.stringify(record.proposedPatch || {}),
    }));
}

function autosizeColumns(rows, headers) {
  return headers.map((header) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[header] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 12), 60) };
  });
}

function main() {
  if (!REPORT_PATH) {
    console.error('Usage: node export_fill_missing_review.js --report <audit.json> [--output <basename>]');
    process.exit(1);
  }

  const report = readJson(REPORT_PATH);
  const rows = buildRows(report);
  const basePath = OUTPUT_BASENAME || path.join(path.dirname(REPORT_PATH), normalizeBasename(REPORT_PATH));
  const csvPath = `${basePath}.csv`;
  const xlsxPath = `${basePath}.xlsx`;

  const headers = [
    'companyId',
    'numeroSociete',
    'name',
    'action',
    'overallConfidence',
    'applyRow',
    'missingFields',
    'missing_typeClient',
    'missing_sousType',
    'missing_departement',
    'missing_departementNumero',
    'currentTypeClient',
    'currentSousType',
    'currentDepartement',
    'currentDepartementNumero',
    'currentAddressPostcode',
    'proposedTypeClient',
    'proposedSousType',
    'proposedDepartement',
    'proposedDepartementNumero',
    'finalTypeClient',
    'finalSousType',
    'finalDepartement',
    'finalDepartementNumero',
    'reviewComment',
    'classificationRule',
    'classificationReason',
    'departementReason',
    'proposedPatchJson',
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  worksheet['!cols'] = autosizeColumns(rows, headers);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'fill_missing');
  XLSX.writeFile(workbook, xlsxPath);

  const csv = XLSX.utils.sheet_to_csv(worksheet);
  fs.writeFileSync(csvPath, csv);

  console.log(`CSV généré  : ${csvPath}`);
  console.log(`XLSX généré : ${xlsxPath}`);
  console.log(`Lignes fill_missing : ${rows.length}`);
}

main();
