const { metadataRequest } = require('./http');

let schemaPromise = null;

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseOptions(rawOptions) {
  if (!rawOptions) return [];

  if (Array.isArray(rawOptions)) return rawOptions;

  try {
    const parsed = JSON.parse(rawOptions);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function buildField(field) {
  const options = parseOptions(field.options);
  const optionLookup = new Map();
  const optionsByNumero = new Map();

  for (const option of options) {
    const normalizedValue = normalizeText(option.value);
    const normalizedLabel = normalizeText(option.label);

    if (normalizedValue) optionLookup.set(normalizedValue, option);
    if (normalizedLabel) optionLookup.set(normalizedLabel, option);

    const match = String(option.label || option.value || '').match(/\b(2A|2B|\d{2,3})\b/);
    if (match) {
      optionsByNumero.set(match[1], option);
    }
  }

  return {
    ...field,
    options,
    optionLookup,
    optionsByNumero,
  };
}

async function loadCompanySchema() {
  const query = `
    query CompanyMetadata {
      objects(paging: { first: 100 }) {
        edges {
          node {
            id
            nameSingular
            namePlural
            labelSingular
            fields(paging: { first: 500 }) {
              edges {
                node {
                  id
                  name
                  label
                  type
                  options
                  isNullable
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await metadataRequest(query);
  const companyNode = result?.objects?.edges?.find(
    (edge) => edge?.node?.nameSingular === 'company'
  )?.node;

  if (!companyNode) {
    throw new Error('Objet metadata "company" introuvable dans Twenty.');
  }

  const fields = {};
  for (const edge of companyNode.fields.edges || []) {
    const field = buildField(edge.node);
    fields[field.name] = field;
  }

  return {
    objectId: companyNode.id,
    nameSingular: companyNode.nameSingular,
    namePlural: companyNode.namePlural,
    labelSingular: companyNode.labelSingular,
    fields,
  };
}

async function getCompanySchema(options = {}) {
  if (!schemaPromise || options.forceRefresh) {
    schemaPromise = loadCompanySchema();
  }

  return schemaPromise;
}

function getField(schema, fieldName) {
  return schema?.fields?.[fieldName] || null;
}

function resolveSelectOption(field, aliases = []) {
  if (!field || !field.optionLookup) return null;

  for (const alias of aliases) {
    const option = field.optionLookup.get(normalizeText(alias));
    if (option) return option;
  }

  return null;
}

function resolveOptionValue(field, aliases = []) {
  return resolveSelectOption(field, aliases)?.value || null;
}

function resolveDepartementOption(field, numero, fallbackCode = null) {
  if (!field) return fallbackCode;

  if (numero && field.optionsByNumero.has(numero)) {
    return field.optionsByNumero.get(numero).value;
  }

  if (fallbackCode) {
    const option = resolveSelectOption(field, [fallbackCode]);
    if (option) return option.value;
  }

  return fallbackCode;
}

function getSchemaSummary(schema) {
  const fieldNames = ['typeClient', 'sousType', 'departement', 'departementNumero'];

  return fieldNames.reduce((acc, fieldName) => {
    const field = getField(schema, fieldName);
    acc[fieldName] = field
      ? {
          exists: true,
          type: field.type,
          options: field.options.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        }
      : { exists: false };
    return acc;
  }, {});
}

module.exports = {
  getCompanySchema,
  getField,
  getSchemaSummary,
  normalizeText,
  resolveOptionValue,
  resolveSelectOption,
  resolveDepartementOption,
};
