function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/['’]/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const RULES = [
  {
    id: 'school_ensemble_scolaire',
    typeClient: 'ETABLISSEMENT_SCOLAIRE',
    sousType: 'ENSEMBLE SCOLAIRE',
    confidence: 'high',
    reason: 'Nom contenant un marqueur explicite d’ensemble scolaire.',
    patterns: [/\bENSEMBLE SCOLAIRE\b/],
  },
  {
    id: 'association',
    typeClient: 'AUTRE',
    sousType: 'ASSOCIATION',
    confidence: 'high',
    reason: 'Nom contenant un marqueur explicite d’association.',
    patterns: [
      /\bASSOCIATION\b/,
      /\bASSOC\b/,
      /\bASSO\b/,
      /\bASSOCIATIVE\b/,
      /\bOGEC\b/,
      /\bAPEL\b/,
    ],
  },
  {
    id: 'ehpad',
    typeClient: 'AUTRE',
    sousType: 'EHPAD',
    confidence: 'high',
    reason: 'Nom contenant un marqueur explicite d’EHPAD ou assimilé.',
    patterns: [
      /\bEHPAD\b/,
      /\bMAISON DE RETRAITE\b/,
      /\bRESIDENCE AUTONOMIE\b/,
      /\bRESIDENCE SENIORS\b/,
    ],
  },
  {
    id: 'school_college',
    typeClient: 'ETABLISSEMENT_SCOLAIRE',
    sousType: 'COLLEGE',
    confidence: 'high',
    reason: 'Nom contenant un marqueur explicite de collège.',
    patterns: [/\bCOLLEGE\b/],
  },
  {
    id: 'school_lycee',
    typeClient: 'ETABLISSEMENT_SCOLAIRE',
    sousType: 'LYCEE',
    confidence: 'high',
    reason: 'Nom contenant un marqueur explicite de lycée.',
    patterns: [/\bLYCEE\b/],
  },
  {
    id: 'school_ecole',
    typeClient: 'ETABLISSEMENT_SCOLAIRE',
    sousType: 'ECOLE',
    confidence: 'high',
    reason: 'Nom contenant un marqueur explicite d’école.',
    patterns: [
      /\bECOLE\b/,
      /\bGROUPE SCOLAIRE\b/,
      /\bECOLE PRIMAIRE\b/,
      /\bECOLE MATERNELLE\b/,
      /\bECOLE ELEMENTAIRE\b/,
    ],
  },
  {
    id: 'mairie',
    typeClient: 'MAIRIE_COLLECTIVITE',
    sousType: 'MAIRIE',
    confidence: 'high',
    reason: 'Nom contenant un marqueur explicite de mairie ou commune.',
    patterns: [
      /\bMAIRIE\b/,
      /\bVILLE DE\b/,
      /\bCOMMUNE DE\b/,
      /\bHOTEL DE VILLE\b/,
      /\bCCAS\b/,
      /\bCIAS\b/,
    ],
  },
  {
    id: 'collectivite',
    typeClient: 'MAIRIE_COLLECTIVITE',
    sousType: 'COMMUNAUTE_DE_COMMUNES',
    confidence: 'high',
    reason: 'Nom contenant un marqueur explicite de collectivité ou intercommunalité.',
    patterns: [
      /\bCOMMUNAUTE\b/,
      /\bCOMMUNAUTE DE COMMUNES\b/,
      /\bCOMMUNAUTE D AGGLOMERATION\b/,
      /\bCOMMUNAUTE URBAINE\b/,
      /\bMETROPOLE\b/,
      /\bAGGLO\b/,
      /\bCC DE\b/,
      /\bCC DU\b/,
      /\bCOMMUNAUTE DE\b/,
      /\bCA DE\b/,
      /\bCU DE\b/,
      /\bSYNDICAT MIXTE\b/,
      /\bCONSEIL DEPARTEMENTAL\b/,
      /\bCONSEIL REGIONAL\b/,
    ],
  },
  {
    id: 'enterprise_legal_form',
    typeClient: 'ENTREPRISE_TPE_PME',
    sousType: 'AUTRE',
    confidence: 'high',
    reason: 'Nom contenant une forme juridique d’entreprise.',
    patterns: [
      /\bSARL\b/,
      /\bEURL\b/,
      /\bSASU?\b/,
      /\bSA\b/,
      /\bSCI\b/,
      /\bSCOP\b/,
      /\bSCIC\b/,
      /\bSELARL\b/,
      /\bSELAS\b/,
      /\bSCEA\b/,
      /\bEARL\b/,
      /\bGAEC\b/,
      /\bCABINET\b/,
      /\bENTREPRISE\b/,
      /\bSOCIETE\b/,
      /\bETS\b/,
      /\bETABLISSEMENTS\b/,
    ],
  },
];

/**
 * Déduit le type de client à partir du nom de société.
 *
 * @param {string} name - Company name
 * @returns {Object} Résultat enrichi pour audit/import/backfill
 */
function classifyClient(name) {
  const normalizedName = normalizeName(name);

  if (!normalizedName) {
    return {
      typeClient: null,
      sousType: null,
      confidence: 'low',
      reason: 'Nom de société vide.',
      ruleId: 'empty_name',
      normalizedName,
    };
  }

  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalizedName))) {
      return {
        typeClient: rule.typeClient,
        sousType: rule.sousType,
        confidence: rule.confidence,
        reason: rule.reason,
        ruleId: rule.id,
        normalizedName,
      };
    }
  }

  return {
    typeClient: 'ENTREPRISE_TPE_PME',
    sousType: 'AUTRE',
    confidence: 'medium',
    reason: 'Aucun marqueur métier explicite: classement par défaut en entreprise/TPE-PME.',
    ruleId: 'default_enterprise',
    normalizedName,
  };
}

module.exports = {
  classifyClient,
  normalizeName,
};
