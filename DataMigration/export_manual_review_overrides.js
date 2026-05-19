#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');

const { DEFAULT_OVERRIDES_PATH, readOverridesFile } = require('./lib/core/company-overrides');

const args = minimist(process.argv.slice(2));
const REPORT_PATH = args.report ? path.resolve(args.report) : null;
const OUTPUT_PATH = args.output
  ? path.resolve(args.output)
  : path.join(path.dirname(DEFAULT_OVERRIDES_PATH), 'company_type_overrides.manual_review.template.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function main() {
  if (!REPORT_PATH) {
    console.error('Usage: node export_manual_review_overrides.js --report <audit.json> [--output <file.json>]');
    process.exit(1);
  }

  const report = readJson(REPORT_PATH);
  const existingOverrides = readOverridesFile(DEFAULT_OVERRIDES_PATH);
  const template = { companies: {} };

  for (const record of report.records || []) {
    if (record.action !== 'manual_review') continue;

    const key = String(record.numeroSociete || record.companyId);
    const existing = existingOverrides.companies?.[key] || {};

    template.companies[key] = {
      name: record.name,
      currentTypeClient: record.current?.typeClient || null,
      currentSousType: record.current?.sousType || null,
      suggestedTypeClient: record.derived?.typeClient || null,
      suggestedSousType: record.derived?.sousType || null,
      typeClient: existing.typeClient || '',
      sousType: existing.sousType || '',
      comment: existing.comment || '',
    };
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(template, null, 2));

  console.log(`Template généré: ${OUTPUT_PATH}`);
  console.log(`Cas manual_review: ${Object.keys(template.companies).length}`);
}

main();
