const fs = require('fs');
const path = require('path');

const DEFAULT_OVERRIDES_PATH = path.join(__dirname, '../../company_type_overrides.json');

function readOverridesFile(filePath = DEFAULT_OVERRIDES_PATH) {
  if (!fs.existsSync(filePath)) {
    return { companies: {} };
  }

  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  if (!raw) {
    return { companies: {} };
  }

  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' ? parsed : { companies: {} };
}

function getCompanyOverride({ numeroSociete, companyId }, options = {}) {
  const overrides = options.overrides || readOverridesFile(options.filePath || DEFAULT_OVERRIDES_PATH);
  const companies = overrides.companies || {};

  if (numeroSociete != null && companies[String(numeroSociete)]) {
    return companies[String(numeroSociete)];
  }

  if (companyId && companies[companyId]) {
    return companies[companyId];
  }

  return null;
}

module.exports = {
  DEFAULT_OVERRIDES_PATH,
  getCompanyOverride,
  readOverridesFile,
};
