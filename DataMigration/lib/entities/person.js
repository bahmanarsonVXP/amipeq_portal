const { restRequest } = require('../core/http');
const mappings = require('../core/mappings');

/**
 * Ensure person exists in TWENTY CRM
 * Checks mappings cache using key: "numeroSociete|contact"
 *
 * @param {string} numeroSociete - Company reference
 * @param {string} contact - Full name
 * @param {string} email - Email address
 * @param {string} telephone - Phone number
 * @param {string} ville - City
 * @param {string} companyId - UUID of parent company
 * @param {Object} options - { dryRun: boolean }
 * @returns {Promise<Object>} { status: 'created'|'existing', id: string, error: null }
 */
async function ensurePersonExists(numeroSociete, contact, email, telephone, ville, companyId, options = {}) {
  // Skip if no contact name
  if (!contact || contact.trim() === '') {
    return { status: 'skipped', id: null, error: 'No contact name' };
  }

  // Check cache first
  const cachedId = mappings.getPerson(numeroSociete, contact);
  if (cachedId) {
    return { status: 'existing', id: cachedId, error: null };
  }

  // Dry run mode - validate only, don't create
  if (options.dryRun) {
    return { status: 'simulated', id: 'dry-run-id', error: null };
  }

  // Parse name into firstName and lastName
  const nameParts = contact.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || '';

  // Build request body
  const body = {
    name: {
      firstName: firstName,
      lastName: lastName
    },
    companyId: companyId,
    createdBy: {
      source: "IMPORT",
      workspaceMemberId: null,
      name: "Alexandra",
      context: {}
    }
  };

  // Add optional fields only if they have values
  if (email && email.trim() !== '') {
    body.email = email.trim();
  }

  if (telephone && telephone.trim() !== '') {
    body.phone = telephone.trim();
  }

  if (ville && ville.trim() !== '') {
    body.city = ville.trim();
  }

  // Create person via REST API
  try {
    const result = await restRequest('POST', '/rest/people', body);

    if (result.statusCode === 201 || result.statusCode === 200) {
      const id = result.data.data?.createPerson?.id || result.data.data?.id;

      // Save to mappings cache
      mappings.savePerson(numeroSociete, contact, id);

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
  ensurePersonExists
};
