/**
 * Parse "Norme" field to extract prestations
 *
 * NOTE: Current TWENTY schema does NOT support nature/modalite fields
 * These must always be null (validated via import tests)
 *
 * @param {string} norme - Raw norme string from Excel (e.g., "DUERP + FORM")
 * @returns {Object} { prestations: string[], nature: null, modalite: null }
 */
function parseNorme(norme) {
  const prestations = [];
  let nature = null;    // TWENTY n'accepte que null pour naturePrestation
  let modalite = null;  // TWENTY n'accepte que null pour modalite

  if (!norme) return { prestations: ['DUERP'], nature, modalite };

  const upper = String(norme).toUpperCase();

  // Detect prestation types
  if (upper.includes('DUERP') || upper.includes('DUER')) {
    prestations.push('DUERP');
  }
  if (upper.includes('FORM')) {
    prestations.push('FORMATION');
  }
  if (upper.includes('AUDIT')) {
    prestations.push('AUDIT');
  }

  // Default to DUERP if nothing detected
  if (prestations.length === 0) {
    prestations.push('DUERP');
  }

  // NOTE: Nature and modalite are intentionally not parsed
  // Version 1 parsing (6 types + nature/modalite) caused errors:
  // - "Invalid value 'DU' for field \"naturePrestation\""
  // - "Invalid value 'DISTANCIEL' for field \"modalite\""
  // See: RAPPORT_IMPORT_OPPORTUNITIES.md lines 42-96

  return { prestations, nature, modalite };
}

/**
 * Legacy parseNorme (Version 1) - kept for reference
 * DO NOT USE - causes API validation errors
 *
 * This version extracted 6 prestation types and tried to set
 * nature (CREATION/MISE_A_JOUR) and modalite (A_DISTANCE/SUR_SITE)
 * but TWENTY schema rejects these values.
 */
function parseNormeLegacy(raw) {
  const prestations = [];
  let nature = null;
  let modalite = null;

  if (!raw) return { prestations: ['DUERP'], nature, modalite };

  const upper = String(raw).toUpperCase();
  const parts = upper.split('+').map(p => p.trim());

  // Prestations (6 types in legacy version)
  for (const part of parts) {
    if (part.includes('DUERP') || part.includes('DUER')) prestations.push('DUERP');
    if (part.includes('PPMS')) prestations.push('PPMS');
    if (part.includes('RPS')) prestations.push('RPS');
    if (part.includes('PSE')) prestations.push('PSE');
    if (part.includes('COVID')) prestations.push('COVID');
    if (part.includes('RGPD')) prestations.push('RGPD');
  }

  // Nature (REJECTED by TWENTY API)
  // if (upper.includes('CREATION')) nature = 'CREATION';
  // if (upper.includes('MAJ') || upper.includes('MISE A JOUR')) nature = 'MISE_A_JOUR';
  // if (upper.includes('CONTRAT')) nature = 'CONTRAT_MAJ';

  // Modalite (REJECTED by TWENTY API)
  // if (upper.includes('DISTANCE') || upper.includes('DISTANCIEL')) modalite = 'A_DISTANCE';
  // if (upper.includes('SITE') || upper.includes('PRESENTIEL')) modalite = 'SUR_SITE';

  if (prestations.length === 0) prestations.push('DUERP');

  return { prestations, nature, modalite };
}

module.exports = {
  parseNorme,           // Version 2 (current - use this)
  parseNormeLegacy      // Version 1 (deprecated - reference only)
};
