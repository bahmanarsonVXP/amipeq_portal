const { graphqlRequest } = require('../core/http');
const mappings = require('../core/mappings');
const { deriveCompanyFields } = require('../core/company-derived');
const { getField } = require('../core/company-schema');

const syncedCompanyIds = new Set();

function isBlank(value) {
  return value === null || value === undefined || value === '';
}

function buildCompanyData(numeroSociete, nom, fullRowData, derivedValues, schema) {
  const data = {
    name: nom,
    numeroSociete: Number(numeroSociete),
    createdBy: {
      source: 'IMPORT',
      workspaceMemberId: null,
      name: 'Alexandra',
      context: {}
    },
    address: {
      addressStreet1: fullRowData.adresse1 || null,
      addressCity: fullRowData.ville || null,
      addressPostcode: derivedValues.addressPostcode || null,
      addressCountry: 'France'
    }
  };

  if (derivedValues.typeClient && getField(schema, 'typeClient')) {
    data.typeClient = derivedValues.typeClient;
  }

  if (derivedValues.sousType && getField(schema, 'sousType')) {
    data.sousType = derivedValues.sousType;
  }

  if (derivedValues.departement && getField(schema, 'departement')) {
    data.departement = derivedValues.departement;
  }

  if (derivedValues.departementNumero && getField(schema, 'departementNumero')) {
    data.departementNumero = derivedValues.departementNumero;
  }

  return data;
}

async function fetchCurrentCompany(companyId, schema) {
  const optionalFields = [
    getField(schema, 'typeClient') ? 'typeClient' : null,
    getField(schema, 'sousType') ? 'sousType' : null,
    getField(schema, 'departement') ? 'departement' : null,
    getField(schema, 'departementNumero') ? 'departementNumero' : null,
  ].filter(Boolean).join('\n            ');

  const query = `
    query GetCompanyForSync($filter: CompanyFilterInput!) {
      companies(filter: $filter, first: 1) {
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

  const result = await graphqlRequest(query, {
    filter: { id: { eq: companyId } }
  });

  return result?.companies?.edges?.[0]?.node || null;
}

function buildMissingDerivedPatch(currentCompany, fullRowData, derivedValues, schema) {
  const patch = {};

  if (getField(schema, 'typeClient') && isBlank(currentCompany.typeClient) && derivedValues.typeClient) {
    patch.typeClient = derivedValues.typeClient;
  }

  if (getField(schema, 'sousType') && isBlank(currentCompany.sousType) && derivedValues.sousType) {
    patch.sousType = derivedValues.sousType;
  }

  if (getField(schema, 'departement') && isBlank(currentCompany.departement) && derivedValues.departement) {
    patch.departement = derivedValues.departement;
  }

  if (
    getField(schema, 'departementNumero') &&
    isBlank(currentCompany.departementNumero) &&
    derivedValues.departementNumero
  ) {
    patch.departementNumero = derivedValues.departementNumero;
  }

  const currentAddress = currentCompany.address || {};
  const targetAddressPostcode = currentAddress.addressPostcode || derivedValues.addressPostcode || null;

  if (
    !currentAddress.addressPostcode &&
    targetAddressPostcode
  ) {
    patch.address = {
      addressStreet1: currentAddress.addressStreet1 || fullRowData.adresse1 || null,
      addressCity: currentAddress.addressCity || fullRowData.ville || null,
      addressPostcode: targetAddressPostcode,
      addressCountry: currentAddress.addressCountry || 'France'
    };
  }

  return patch;
}

async function syncDerivedCompanyFields(companyId, nom, cpRaw, fullRowData = {}, options = {}) {
  if (options.syncDerivedFields === false || syncedCompanyIds.has(companyId)) {
    return;
  }

  const { schema, derived } = await deriveCompanyFields({
    name: nom,
    cpRaw: cpRaw || fullRowData.cp || fullRowData.cpRaw,
    numeroSociete,
    companyId,
  });

  const currentCompany = await fetchCurrentCompany(companyId, schema);
  if (!currentCompany) {
    syncedCompanyIds.add(companyId);
    return;
  }

  const patch = buildMissingDerivedPatch(currentCompany, fullRowData, derived, schema);
  if (Object.keys(patch).length === 0) {
    syncedCompanyIds.add(companyId);
    return;
  }

  const mutation = `
    mutation UpdateCompanyDerivedFields($id: ID!, $data: CompanyUpdateInput!) {
      updateCompany(id: $id, data: $data) {
        id
      }
    }
  `;

  await graphqlRequest(mutation, {
    id: companyId,
    data: patch,
  });

  syncedCompanyIds.add(companyId);
}

/**
 * Ensure company exists in TWENTY CRM
 * First checks mappings cache, then creates if needed
 *
 * @param {string} numeroSociete - Unique company number
 * @param {string} nom - Company name
 * @param {string} cpRaw - Postal code (for department extraction)
 * @param {Object} fullRowData - Complete row data for additional fields
 * @param {Object} options - { dryRun: boolean }
 * @returns {Promise<Object>} { status: 'created'|'existing', id: string, error: null }
 */
async function ensureCompanyExists(numeroSociete, nom, cpRaw, fullRowData = {}, options = {}) {
  // Check cache first
  const cachedId = mappings.getCompany(numeroSociete);
  if (cachedId) {
    if (!options.dryRun) {
      try {
        await syncDerivedCompanyFields(cachedId, nom, cpRaw, fullRowData, options);
      } catch (_) {
        // Keep import resilient: a sync failure must not block the existing company reuse.
      }
    }
    return { status: 'existing', id: cachedId, error: null };
  }

  // Dry run mode - validate only, don't create
  if (options.dryRun) {
    return { status: 'simulated', id: 'dry-run-id', error: null };
  }

  const { schema, derived } = await deriveCompanyFields({
    name: nom,
    cpRaw: cpRaw || fullRowData.cp || fullRowData.cpRaw,
    numeroSociete,
  });
  const body = buildCompanyData(numeroSociete, nom, fullRowData, derived, schema);

  const mutation = `
    mutation CreateCompany($data: CompanyCreateInput!) {
      createCompany(data: $data) { id }
    }
  `;

  try {
    const result = await graphqlRequest(mutation, { data: body });
    const id = result?.createCompany?.id;

    if (id) {
      mappings.saveCompany(numeroSociete, id);
      return { status: 'created', id, error: null };
    } else {
      return { status: 'error', id: null, error: 'ID absent de la réponse GraphQL' };
    }
  } catch (error) {
    return { status: 'error', id: null, error: error.message };
  }
}

module.exports = {
  ensureCompanyExists
};
