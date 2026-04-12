const { ensureCompanyExists } = require('./entities/company');
const { ensurePersonExists } = require('./entities/person');
const { createOpportunity } = require('./entities/opportunity');

/**
 * Process ONE Excel row and ensure all entities are created
 * This is the core function of the modular architecture
 *
 * Strategy: Continue on partial failure
 * - If company creation fails, person and opportunity are skipped
 * - If person creation fails, opportunity is still attempted (person is optional)
 * - All errors are logged in the result object
 *
 * @param {Object} rowData - Parsed Excel row with fields:
 *   - numeroSociete, nom, cpRaw
 *   - contact, email, telephone, ville
 *   - numeroDevis, dateDevis, offre1, offre2, norme
 *   - couleurDevis (VERT/GRIS/BLANC from cell color)
 *   - dateDocsEnvoyes
 * @param {string} sheetName - Source sheet (e.g., "2023", "2026")
 * @param {Object} options - Processing options
 * @param {boolean} options.skipCompany - Skip company creation
 * @param {boolean} options.skipPerson - Skip person creation
 * @param {boolean} options.skipOpportunity - Skip opportunity creation
 * @param {boolean} options.dryRun - Validate only, don't create
 *
 * @returns {Promise<Object>} Result object:
 *   {
 *     company: { status: 'created'|'existing'|'error', id: '...', error: null },
 *     person: { status: 'created'|'existing'|'error', id: '...', error: null },
 *     opportunity: { status: 'created'|'duplicate'|'error', id: '...', error: null },
 *     errors: []
 *   }
 */
async function processExcelRow(rowData, sheetName, options = {}) {
  const result = {
    company: null,
    person: null,
    opportunity: null,
    errors: []
  };

  // Step 1: Ensure company exists
  if (!options.skipCompany) {
    try {
      result.company = await ensureCompanyExists(
        rowData.numeroSociete,
        rowData.nom,
        rowData.cpRaw,
        rowData,
        options
      );

      if (result.company.status === 'error') {
        result.errors.push({
          entity: 'company',
          numeroSociete: rowData.numeroSociete,
          error: result.company.error
        });
      }
    } catch (error) {
      result.company = { status: 'error', id: null, error: error.message };
      result.errors.push({
        entity: 'company',
        numeroSociete: rowData.numeroSociete,
        error: error.message
      });
    }
  } else {
    result.company = { status: 'skipped', id: null, error: null };
  }

  // Step 2: Ensure person exists (only if company succeeded)
  if (!options.skipPerson && result.company?.id) {
    try {
      result.person = await ensurePersonExists(
        rowData.numeroSociete,
        rowData.contact,
        rowData.email,
        rowData.telephone,
        rowData.ville,
        result.company.id,
        options
      );

      if (result.person.status === 'error') {
        result.errors.push({
          entity: 'person',
          contact: rowData.contact,
          error: result.person.error
        });
      }
    } catch (error) {
      result.person = { status: 'error', id: null, error: error.message };
      result.errors.push({
        entity: 'person',
        contact: rowData.contact,
        error: error.message
      });
    }
  } else if (!result.company?.id) {
    result.person = { status: 'skipped', id: null, error: 'Company failed' };
  } else {
    result.person = { status: 'skipped', id: null, error: null };
  }

  // Step 3: Create opportunity (requires company, person optional)
  if (!options.skipOpportunity && result.company?.id) {
    try {
      result.opportunity = await createOpportunity(
        rowData,
        result.company.id,
        result.person?.id || null,
        sheetName,
        options
      );

      if (result.opportunity.status === 'error') {
        result.errors.push({
          entity: 'opportunity',
          numeroDevis: rowData.numeroDevis,
          error: result.opportunity.error
        });
      }
    } catch (error) {
      result.opportunity = { status: 'error', id: null, error: error.message };
      result.errors.push({
        entity: 'opportunity',
        numeroDevis: rowData.numeroDevis,
        error: error.message
      });
    }
  } else if (!result.company?.id) {
    result.opportunity = { status: 'skipped', id: null, error: 'Company required' };
  } else {
    result.opportunity = { status: 'skipped', id: null, error: null };
  }

  return result;
}

module.exports = {
  processExcelRow
};
