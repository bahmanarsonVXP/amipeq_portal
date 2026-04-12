/**
 * Automatically classify client type based on company name
 * Used for auto-populating typeClient field in TWENTY
 *
 * @param {string} name - Company name
 * @returns {Object} { typeClient: string, sousType: string|null }
 */
function classifyClient(name) {
  const upper = name.toUpperCase();

  let typeClient = 'AUTRE';
  let sousType = null;

  // Educational institutions
  if (/COLLEGE|LYCEE|LYCÉE|ECOLE|ÉCOLE|GROUPE SCOLAIRE/.test(upper)) {
    typeClient = 'ETABLISSEMENT_SCOLAIRE';
    if (/COLLEGE/.test(upper)) sousType = 'COLLEGE';
    else if (/LYCEE|LYCÉE/.test(upper)) sousType = 'LYCEE';
    else if (/ECOLE|ÉCOLE/.test(upper)) sousType = 'ECOLE';
  }
  // Government/municipalities
  else if (/MAIRIE|COMMUNAUT|AGGLO|CC DE|CC DU/.test(upper)) {
    typeClient = 'MAIRIE_COLLECTIVITE';
    if (/MAIRIE/.test(upper)) sousType = 'MAIRIE';
    else if (/COMMUNAUT|AGGLO/.test(upper)) sousType = 'COMMUNAUTE_COMMUNES';
  }
  // Nursing homes
  else if (/EHPAD/.test(upper)) {
    typeClient = 'AUTRE';
    sousType = 'EHPAD';
  }
  // Default: small/medium business
  else {
    typeClient = 'ENTREPRISE_TPE_PME';
  }

  return { typeClient, sousType };
}

module.exports = {
  classifyClient
};
