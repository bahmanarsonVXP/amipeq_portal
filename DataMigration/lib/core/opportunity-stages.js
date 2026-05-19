/**
 * Codes canoniques du champ Twenty `stage` (opportunité).
 * Alignés sur le modèle métier OPP_*.
 */

const OPP = {
  NEW: 'OPP_NEW',
  QUOTE_PREP: 'OPP_QUOTE_PREP',
  CLIENT_PENDING: 'OPP_CLIENT_PENDING',
  FOLLOWUP: 'OPP_FOLLOWUP',
  STANDBY: 'OPP_STANDBY',
  WON: 'OPP_WON',
  LOST: 'OPP_LOST',
};

/** Stades « ouverts » (hors gagné/perdu) pour filtres portail */
const ACTIVE_OPPORTUNITY_STAGES = [
  OPP.NEW,
  OPP.QUOTE_PREP,
  OPP.CLIENT_PENDING,
  OPP.FOLLOWUP,
  OPP.STANDBY,
];

/** Ancien value Twenty → nouveau code (idempotent si déjà OPP_*) */
const LEGACY_STAGE_TO_OPP = {
  NOUVEAU: OPP.NEW,
  DEVIS_EN_COURS: OPP.QUOTE_PREP,
  DEVIS_EN_RELECTURE: OPP.QUOTE_PREP,
  DEVIS_ENVOYE: OPP.CLIENT_PENDING,
  RELANCE: OPP.FOLLOWUP,
  GAGNE: OPP.WON,
  PERDU: OPP.LOST,
  EN_ATTENTE: OPP.CLIENT_PENDING,
};

/** Options finales pour le champ SELECT `stage` dans Twenty (metadata) */
const STAGE_FIELD_OPTIONS_FOR_TWENTY = [
  { value: OPP.NEW, label: 'Nouvelle', color: 'red', position: 0 },
  { value: OPP.QUOTE_PREP, label: 'Devis en cours', color: 'purple', position: 1 },
  { value: OPP.CLIENT_PENDING, label: 'Attente retour client', color: 'sky', position: 2 },
  { value: OPP.FOLLOWUP, label: 'Suivi client actif', color: 'turquoise', position: 3 },
  { value: OPP.STANDBY, label: 'Standby / report', color: 'gray', position: 4 },
  { value: OPP.WON, label: 'Gagné', color: 'yellow', position: 5 },
  { value: OPP.LOST, label: 'Perdu', color: 'lime', position: 6 },
];

function mapLegacyStageToOpp(stage) {
  if (stage == null || typeof stage !== 'string') return null;
  const t = stage.trim();
  if (t.startsWith('OPP_')) return t;
  return LEGACY_STAGE_TO_OPP[t] ?? null;
}

function isTerminalStage(stage) {
  if (!stage || typeof stage !== 'string') return false;
  const t = stage.trim();
  return t === OPP.WON || t === OPP.LOST || t === 'GAGNE' || t === 'PERDU';
}

/** Garde la cohérence avec le SELECT `statutDevis` existant (GAGNE / PERDU / EN_ATTENTE) */
function stageToStatutDevis(stage) {
  if (!stage || typeof stage !== 'string') return 'EN_ATTENTE';
  const t = stage.trim();
  if (t === OPP.WON || t === 'GAGNE') return 'GAGNE';
  if (t === OPP.LOST || t === 'PERDU') return 'PERDU';
  return 'EN_ATTENTE';
}

function isOppStageSchemaReady(options) {
  const values = new Set((options || []).map((o) => o.value));
  return STAGE_FIELD_OPTIONS_FOR_TWENTY.every((o) => values.has(o.value));
}

module.exports = {
  OPP,
  ACTIVE_OPPORTUNITY_STAGES,
  LEGACY_STAGE_TO_OPP,
  STAGE_FIELD_OPTIONS_FOR_TWENTY,
  mapLegacyStageToOpp,
  isTerminalStage,
  stageToStatutDevis,
  isOppStageSchemaReady,
};
