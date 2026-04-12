const { restRequest } = require('../core/http');
const mappings = require('../core/mappings');
const { extractDepartement } = require('../parsers/departement');
const { classifyClient } = require('../parsers/client-classifier');

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
    return { status: 'existing', id: cachedId, error: null };
  }

  // Dry run mode - validate only, don't create
  if (options.dryRun) {
    return { status: 'simulated', id: 'dry-run-id', error: null };
  }

  // Extract department and classify client type
  const dept = extractDepartement(cpRaw);
  const { typeClient, sousType } = classifyClient(nom);

  // Build request body
  const body = {
    name: nom,
    numeroSociete: Number(numeroSociete),  // MUST be Number, not string
    createdBy: {
      source: "IMPORT",
      workspaceMemberId: null,
      name: "Alexandra",
      context: {}
    },
    address: {
      addressStreet1: fullRowData.adresse1 || null,
      addressCity: fullRowData.ville || null,
      addressPostcode: fullRowData.cp ? String(Math.floor(Number(fullRowData.cp))).padStart(5, '0') : null,
      addressCountry: 'France'
    }
  };

  // Add optional fields only if they have values
  // IMPORTANT: La Réunion (974) is not configured in TWENTY
  // Skip departement for 974 to avoid errors
  if (dept.code) {
    body.departement = dept.code;
  }

  if (typeClient) {
    body.typeClient = typeClient;
  }

  // sousTypeClient retiré du schéma TWENTY — ne pas envoyer ce champ

  // Create company via REST API
  try {
    const result = await restRequest('POST', '/rest/companies', body);

    if (result.statusCode === 201 || result.statusCode === 200) {
      const id = result.data.data?.createCompany?.id || result.data.data?.id;

      // Save to mappings cache
      mappings.saveCompany(numeroSociete, id);

      return { status: 'created', id, error: null };
    } else {
      const errorMsg = JSON.stringify(result.data).substring(0, 200);
      return { status: 'error', id: null, error: errorMsg };
    }
  } catch (error) {
    return { status: 'error', id: null, error: error.message };
  }
}

module.exports = {
  ensureCompanyExists
};
