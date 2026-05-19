const DEPARTEMENT_NAMES = {
  '01': 'AIN', '02': 'AISNE', '03': 'ALLIER', '04': 'ALPES_DE_HAUTE_PROVENCE',
  '05': 'HAUTES_ALPES', '06': 'ALPES_MARITIMES', '07': 'ARDECHE', '08': 'ARDENNES',
  '09': 'ARIEGE', '10': 'AUBE', '11': 'AUDE', '12': 'AVEYRON',
  '13': 'BOUCHES_DU_RHONE', '14': 'CALVADOS', '15': 'CANTAL', '16': 'CHARENTE',
  '17': 'CHARENTE_MARITIME', '18': 'CHER', '19': 'CORREZE',
  '21': 'COTE_D_OR', '22': 'COTES_D_ARMOR', '23': 'CREUSE',
  '24': 'DORDOGNE', '25': 'DOUBS', '26': 'DROME', '27': 'EURE',
  '28': 'EURE_ET_LOIR', '29': 'FINISTERE',
  '30': 'GARD', '31': 'HAUTE_GARONNE', '32': 'GERS', '33': 'GIRONDE',
  '34': 'HERAULT', '35': 'ILLE_ET_VILAINE',
  '36': 'INDRE', '37': 'INDRE_ET_LOIRE', '38': 'ISERE', '39': 'JURA',
  '40': 'LANDES', '41': 'LOIR_ET_CHER',
  '42': 'LOIRE', '43': 'HAUTE_LOIRE', '44': 'LOIRE_ATLANTIQUE', '45': 'LOIRET',
  '46': 'LOT', '47': 'LOT_ET_GARONNE',
  '48': 'LOZERE', '49': 'MAINE_ET_LOIRE', '50': 'MANCHE', '51': 'MARNE',
  '52': 'HAUTE_MARNE', '53': 'MAYENNE',
  '54': 'MEURTHE_ET_MOSELLE', '55': 'MEUSE', '56': 'MORBIHAN', '57': 'MOSELLE',
  '58': 'NIEVRE', '59': 'NORD',
  '60': 'OISE', '61': 'ORNE', '62': 'PAS_DE_CALAIS', '63': 'PUY_DE_DOME',
  '64': 'PYRENEES_ATLANTIQUES', '65': 'HAUTES_PYRENEES',
  '66': 'PYRENEES_ORIENTALES', '67': 'BAS_RHIN', '68': 'HAUT_RHIN', '69': 'RHONE',
  '70': 'HAUTE_SAONE', '71': 'SAONE_ET_LOIRE',
  '72': 'SARTHE', '73': 'SAVOIE', '74': 'HAUTE_SAVOIE', '75': 'PARIS',
  '76': 'SEINE_MARITIME', '77': 'SEINE_ET_MARNE',
  '78': 'YVELINES', '79': 'DEUX_SEVRES', '80': 'SOMME', '81': 'TARN',
  '82': 'TARN_ET_GARONNE', '83': 'VAR',
  '84': 'VAUCLUSE', '85': 'VENDEE', '86': 'VIENNE', '87': 'HAUTE_VIENNE',
  '88': 'VOSGES', '89': 'YONNE',
  '90': 'TERRITOIRE_DE_BELFORT', '91': 'ESSONNE', '92': 'HAUTS_DE_SEINE',
  '93': 'SEINE_SAINT_DENIS', '94': 'VAL_DE_MARNE', '95': 'VAL_D_OISE',
  '2A': 'CORSE_DU_SUD', '2B': 'HAUTE_CORSE',
  '971': 'GUADELOUPE', '972': 'MARTINIQUE', '973': 'GUYANE',
  '974': 'LA_REUNION', '976': 'MAYOTTE',
};

function normalizePostalCode(cpRaw) {
  if (cpRaw === null || cpRaw === undefined) return null;

  const raw = String(cpRaw).trim();
  if (!raw) return null;

  let digits = raw.replace(/\D/g, '');

  // Excel stores many postal codes as numbers without leading zeros.
  if (!digits && Number.isFinite(Number(cpRaw))) {
    digits = String(Math.trunc(Number(cpRaw)));
  }

  if (!/^\d{1,5}$/.test(digits)) return null;
  return digits.padStart(5, '0');
}

function getDepartementNumeroFromPostalCode(postalCode) {
  if (!postalCode) return null;

  const overseasPrefix = postalCode.slice(0, 3);
  if (['971', '972', '973', '974', '976'].includes(overseasPrefix)) {
    return overseasPrefix;
  }

  if (postalCode.startsWith('20')) {
    return Number(postalCode) < 20200 ? '2A' : '2B';
  }

  return postalCode.slice(0, 2);
}

function getDepartementCanonicalCode(numero) {
  const name = DEPARTEMENT_NAMES[numero];
  return name ? `DEPT_${numero}_${name}` : null;
}

/**
 * Extract département from postal code
 * Handles DOM-TOM, Corse, and Métropole
 *
 * @param {string|number} cpRaw - Raw postal code from Excel/Twenty
 * @param {Object} [options]
 * @param {(numero: string, fallbackCode: string|null) => string|null} [options.resolveDepartementCode]
 * @returns {Object}
 */
function extractDepartement(cpRaw, options = {}) {
  const normalizedPostcode = normalizePostalCode(cpRaw);

  if (!normalizedPostcode) {
    return {
      normalizedPostcode: null,
      numero: null,
      code: null,
      canonicalCode: null,
      isValid: false,
      reason: 'Code postal absent ou invalide.',
    };
  }

  const numero = getDepartementNumeroFromPostalCode(normalizedPostcode);
  const canonicalCode = getDepartementCanonicalCode(numero);
  const code = options.resolveDepartementCode
    ? options.resolveDepartementCode(numero, canonicalCode)
    : canonicalCode;

  return {
    normalizedPostcode,
    numero,
    code: code || null,
    canonicalCode,
    isValid: Boolean(numero),
    reason: numero
      ? 'Département déduit à partir du code postal.'
      : 'Code postal reconnu mais département non mappé.',
  };
}

module.exports = {
  DEPARTEMENT_NAMES,
  extractDepartement,
  getDepartementCanonicalCode,
  getDepartementNumeroFromPostalCode,
  normalizePostalCode,
};
