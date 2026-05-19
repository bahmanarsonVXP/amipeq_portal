const { graphqlRequest } = require('../core/http');
const mappings = require('../core/mappings');
const { parseContactName } = require('../parsers/contact-name');

/**
 * Maps Excel "Titre" (col E) to Twenty CRM genre enum value.
 * @param {string} titre - Raw value from Excel (ex: "M.", "Mme", "Mlle")
 * @returns {string|null} Twenty enum value or null if unrecognized
 */
function parseTitre(titre) {
  if (!titre) return null;
  const t = String(titre).trim().toLowerCase().replace(/\.$/, '');
  if (t === 'm' || t === 'mr' || t === 'monsieur') return 'MONSSIEUR';
  if (t === 'mme' || t === 'madame')               return 'MADAME';
  if (t === 'mlle' || t === 'mademoiselle')         return 'MADEMOISELLE';
  return null;
}

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
 * @param {string} [titre] - Civilité from Excel col E (M., Mme, Mlle)
 * @returns {Promise<Object>} { status: 'created'|'existing', id: string, error: null }
 */
async function ensurePersonExists(numeroSociete, contact, email, telephone, ville, companyId, options = {}, titre = '') {
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

  const { firstName, lastName } = parseContactName(contact);

  // Map titre to genre enum
  const genre = parseTitre(titre);

  // Build GraphQL mutation
  const optionalFields = [
    companyId                                      ? `companyId: "${companyId}"`                                                                          : null,
    email && email.trim()                          ? `emails: { primaryEmail: ${JSON.stringify(email.trim())} }`                                          : null,
    telephone && telephone.trim()                  ? `phones: { primaryPhoneNumber: ${JSON.stringify(telephone.trim())}, primaryPhoneCallingCode: "+33" }` : null,
    ville && ville.trim()                          ? `city: ${JSON.stringify(ville.trim())}`                                                              : null,
    genre                                          ? `genre: ${genre}`                                                                                    : null,
  ].filter(Boolean).join('\n      ');

  const mutation = `mutation {
    createPerson(data: {
      name: { firstName: ${JSON.stringify(firstName || '')}, lastName: ${JSON.stringify(lastName || contact)} }
      ${optionalFields}
    }) { id }
  }`;

  try {
    const result = await graphqlRequest(mutation);
    const id = result?.createPerson?.id;

    if (id) {
      mappings.savePerson(numeroSociete, contact, id);
      return { status: 'created', id, error: null };
    } else {
      return { status: 'error', id: null, error: 'ID absent de la réponse GraphQL' };
    }
  } catch (error) {
    return { status: 'error', id: null, error: error.message };
  }
}

module.exports = {
  ensurePersonExists,
  parseTitre
};
