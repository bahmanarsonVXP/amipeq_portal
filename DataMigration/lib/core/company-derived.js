const { getCompanySchema, getField, resolveOptionValue, resolveDepartementOption } = require('./company-schema');
const { getCompanyOverride } = require('./company-overrides');
const { classifyClient } = require('../parsers/client-classifier');
const { extractDepartement } = require('../parsers/departement');

const TYPE_CLIENT_ALIASES = {
  ETABLISSEMENT_SCOLAIRE: ['ETABLISSEMENT_SCOLAIRE', 'Établissement scolaire', 'Etablissement scolaire'],
  MAIRIE_COLLECTIVITE: ['MAIRIE_COLLECTIVITE', 'Mairie-Collectivité', 'Mairie Collectivite'],
  ENTREPRISE_TPE_PME: ['ENTREPRISE_TPE_PME', 'Entreprise TPE-PME', 'Entreprise TPE PME'],
  AUTRE: ['AUTRE', 'Autre'],
};

const SOUS_TYPE_ALIASES = {
  COLLEGE: ['COLLEGE', 'Collège', 'College'],
  LYCEE: ['LYCEE', 'Lycée', 'Lycee'],
  ECOLE: ['ECOLE', 'École', 'Ecole'],
  MAIRIE: ['MAIRIE', 'Mairie'],
  COMMUNAUTE_DE_COMMUNES: [
    'COMMUNAUTE_DE_COMMUNES',
    'COMMUNAUTE_COMMUNES',
    'Communauté de communes',
    'Communaute de communes',
  ],
  EHPAD: ['EHPAD'],
  ASSOCIATION: ['ASSOCIATION', 'Association'],
  'ENSEMBLE SCOLAIRE': ['ENSEMBLE SCOLAIRE', 'ENSEMBLE_SCOLAIRE', 'Ensemble Scolaire'],
  AUTRE: ['AUTRE', 'Autre'],
};

function getAliases(map, key) {
  return map[key] || [key];
}

function applyManualOverride(baseClassification, override) {
  if (!override) return baseClassification;

  return {
    ...baseClassification,
    typeClient: override.typeClient || baseClassification.typeClient,
    sousType: override.sousType || baseClassification.sousType,
    confidence: 'high',
    reason: override.comment
      ? `Override manuel: ${override.comment}`
      : 'Override manuel défini dans company_type_overrides.json.',
    ruleId: 'manual_override',
    overrideApplied: true,
    overrideComment: override.comment || null,
  };
}

async function deriveCompanyFields({ name, cpRaw, numeroSociete = null, companyId = null }, options = {}) {
  const schema = options.schema || await getCompanySchema();
  const baseClassification = classifyClient(name);
  const override = getCompanyOverride({ numeroSociete, companyId }, options);
  const classification = applyManualOverride(baseClassification, override);
  const departement = extractDepartement(cpRaw, {
    resolveDepartementCode: (numero, fallbackCode) =>
      resolveDepartementOption(getField(schema, 'departement'), numero, fallbackCode),
  });

  const typeClient = classification.typeClient
    ? resolveOptionValue(getField(schema, 'typeClient'), getAliases(TYPE_CLIENT_ALIASES, classification.typeClient)) || classification.typeClient
    : null;

  const sousType = classification.sousType
    ? resolveOptionValue(getField(schema, 'sousType'), getAliases(SOUS_TYPE_ALIASES, classification.sousType)) || classification.sousType
    : null;

  const departementNumero = getField(schema, 'departementNumero') ? departement.numero : null;

  return {
    schema,
    classification,
    override: override || null,
    departement,
    derived: {
      typeClient,
      sousType,
      departement: departement.code,
      departementNumero,
      addressPostcode: departement.normalizedPostcode,
    },
  };
}

module.exports = {
  deriveCompanyFields,
};
