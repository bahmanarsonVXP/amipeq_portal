const { graphqlRequest } = require('../core/http');
const { parseNorme } = require('../parsers/norme');
const { parseExcelDate } = require('../parsers/excel');
const { OPP } = require('../core/opportunity-stages');

/**
 * Calculate stage and statutDevis based on cell color and date age
 *
 * @param {string} couleurDevis - 'VERT', 'GRIS', or 'BLANC'
 * @param {string|number} dateDevis - Date from Excel
 * @param {string} annee - Year (for date parsing)
 * @returns {Object} { stage: string, statutDevis: string }
 */
function calculerStageEtStatut(couleurDevis, dateDevis, annee) {
  // VERT → Won
  if (couleurDevis === 'VERT') {
    return { stage: OPP.WON, statutDevis: 'GAGNE' };
  }

  // GRIS → Lost
  if (couleurDevis === 'GRIS') {
    return { stage: OPP.LOST, statutDevis: 'PERDU' };
  }

  // BLANC → Check age (if > 120 days, consider lost)
  if (couleurDevis === 'BLANC') {
    const dateDevisParsed = parseExcelDate(dateDevis, annee);
    if (dateDevisParsed) {
      const dateDevisObj = new Date(dateDevisParsed);
      const now = new Date();
      const diffJours = Math.floor((now - dateDevisObj) / (1000 * 60 * 60 * 24));
      if (diffJours > 120) {
        return { stage: OPP.CLIENT_PENDING, statutDevis: 'PERDU' };
      }
    }
    return { stage: OPP.CLIENT_PENDING, statutDevis: 'EN_ATTENTE' };
  }

  // Default
  return { stage: OPP.CLIENT_PENDING, statutDevis: 'EN_ATTENTE' };
}

/**
 * Check if opportunity already exists (GraphQL deduplication)
 *
 * @param {string} numeroDevis - Quote number
 * @returns {Promise<boolean>} true if exists
 */
async function checkOpportunityExists(numeroDevis) {
  if (!numeroDevis) return false;

  const query = `
    query CheckOpportunity($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter) {
        totalCount
      }
    }
  `;

  try {
    const result = await graphqlRequest(query, {
      filter: { numeroDevis: { eq: numeroDevis } }
    });
    return result.opportunities.totalCount > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Create opportunity (with GraphQL deduplication check)
 * ALWAYS checks if numeroDevis exists before creating
 *
 * @param {Object} oppData - Opportunity data from Excel row
 * @param {string} companyId - Parent company UUID
 * @param {string|null} personId - Contact person UUID (optional)
 * @param {string} annee - Year from sheet name
 * @param {Object} options - { dryRun: boolean }
 * @returns {Promise<Object>} { status: 'created'|'duplicate', id: string, error: null }
 */
async function createOpportunity(oppData, companyId, personId, annee, options = {}) {
  // Check for duplicate (GraphQL)
  if (oppData.numeroDevis) {
    const exists = await checkOpportunityExists(oppData.numeroDevis);
    if (exists) {
      return { status: 'duplicate', id: null, error: null };
    }
  }

  // Dry run mode - validate only, don't create
  if (options.dryRun) {
    return { status: 'simulated', id: 'dry-run-id', error: null };
  }

  // Parse norme field
  const prestations = parseNorme(oppData.norme); // retourne string[]

  // Calculate discount
  let tauxRemise = null;
  let montantRemise = null;

  if (oppData.offre1 && oppData.offre2) {
    const o1 = Number(oppData.offre1);
    const o2 = Number(oppData.offre2);
    if (o1 > 0 && o2 > 0) {
      tauxRemise = Math.round((1 - o2 / o1) * 100);
      montantRemise = {
        amountMicros: Math.round((o1 - o2) * 1000000),
        currencyCode: 'EUR'
      };
    }
  }

  // Main amount (prefer offre2, fallback to offre1)
  const montantPrincipal = oppData.offre2 || oppData.offre1;

  // Calculate stage and status from cell color
  const { stage, statutDevis } = calculerStageEtStatut(
    oppData.couleurDevis,
    oppData.dateDevis || oppData.date,
    annee
  );

  // Parse date devis
  const parsedDateDevis = parseExcelDate(oppData.dateDevis || oppData.date, annee);

  const name = oppData.numeroDevis || `${oppData.numeroSociete}-${annee}`;
  const amountMicros = montantPrincipal ? Math.round(Number(montantPrincipal) * 1_000_000) : null;

  const optionalFields = [
    companyId                        ? `companyId: "${companyId}"`                                                      : null,
    personId                         ? `pointOfContactId: "${personId}"`                                                : null,
    amountMicros                     ? `amount: { amountMicros: ${amountMicros}, currencyCode: EUR }`                   : null,
    oppData.numeroDevis              ? `numeroDevis: ${JSON.stringify(oppData.numeroDevis)}`                            : null,
    parsedDateDevis                  ? `dateDevis: "${parsedDateDevis}"`                                                : null,
    parsedDateDevis                  ? `createdAt: "${parsedDateDevis}"`                                                : null,
    prestations.length               ? `prestation: [${prestations.map(p => p).join(', ')}]`                           : null,
    oppData.norme                    ? `normeOriginale: ${JSON.stringify(oppData.norme)}`                               : null,
    tauxRemise != null               ? `tauxRemise: ${tauxRemise}`                                                      : null,
    montantRemise                    ? `montantRemise: { amountMicros: ${montantRemise.amountMicros}, currencyCode: EUR }` : null,
    oppData.dateDocsEnvoyes          ? `dateEnvoiDocs: "${oppData.dateDocsEnvoyes}"`                                    : null,
    annee                            ? `anneeDevis: ${Number(annee)}`                                                   : null,
  ].filter(Boolean).join('\n      ');

  const mutation = `mutation {
    createOpportunity(data: {
      name: ${JSON.stringify(name)}
      stage: ${stage}
      statutDevis: ${statutDevis}
      ${optionalFields}
    }) { id }
  }`;

  try {
    const result = await graphqlRequest(mutation);
    const id = result?.createOpportunity?.id;

    if (id) {
      return { status: 'created', id, error: null };
    } else {
      return { status: 'error', id: null, error: 'ID absent de la réponse GraphQL' };
    }
  } catch (error) {
    return { status: 'error', id: null, error: error.message };
  }
}

module.exports = {
  createOpportunity,
  checkOpportunityExists,
  calculerStageEtStatut
};
