/** Codes canoniques Twenty `stage` — opportunité (modèle OPP_*) */

export const OPPORTUNITY_STAGES = {
  NEW: 'OPP_NEW',
  QUOTE_PREP: 'OPP_QUOTE_PREP',
  CLIENT_PENDING: 'OPP_CLIENT_PENDING',
  FOLLOWUP: 'OPP_FOLLOWUP',
  STANDBY: 'OPP_STANDBY',
  WON: 'OPP_WON',
  LOST: 'OPP_LOST',
} as const;

export type OpportunityStageCode = (typeof OPPORTUNITY_STAGES)[keyof typeof OPPORTUNITY_STAGES];

export const ACTIVE_OPPORTUNITY_STAGES: readonly OpportunityStageCode[] = [
  OPPORTUNITY_STAGES.NEW,
  OPPORTUNITY_STAGES.QUOTE_PREP,
  OPPORTUNITY_STAGES.CLIENT_PENDING,
  OPPORTUNITY_STAGES.FOLLOWUP,
  OPPORTUNITY_STAGES.STANDBY,
];

const LEGACY_TO_OPP: Record<string, OpportunityStageCode> = {
  NOUVEAU: OPPORTUNITY_STAGES.NEW,
  DEVIS_EN_COURS: OPPORTUNITY_STAGES.QUOTE_PREP,
  DEVIS_EN_RELECTURE: OPPORTUNITY_STAGES.QUOTE_PREP,
  DEVIS_ENVOYE: OPPORTUNITY_STAGES.CLIENT_PENDING,
  RELANCE: OPPORTUNITY_STAGES.FOLLOWUP,
  GAGNE: OPPORTUNITY_STAGES.WON,
  PERDU: OPPORTUNITY_STAGES.LOST,
  EN_ATTENTE: OPPORTUNITY_STAGES.CLIENT_PENDING,
};

export function mapLegacyStageToOpp(stage: string | null | undefined): OpportunityStageCode | null {
  if (stage == null || typeof stage !== 'string') return null;
  const t = stage.trim();
  if (t.startsWith('OPP_')) return t as OpportunityStageCode;
  return LEGACY_TO_OPP[t] ?? null;
}

/** Terminaux : codes actuels + legacy le temps de lire d’anciennes réponses */
export function isTerminalStageCode(stage: string | null | undefined): boolean {
  if (stage == null || typeof stage !== 'string') return false;
  const t = stage.trim();
  return (
    t === OPPORTUNITY_STAGES.WON ||
    t === OPPORTUNITY_STAGES.LOST ||
    t === 'GAGNE' ||
    t === 'PERDU'
  );
}

export function stageToStatutDevis(stage: string): 'GAGNE' | 'PERDU' | 'EN_ATTENTE' {
  const t = stage.trim();
  if (t === OPPORTUNITY_STAGES.WON || t === 'GAGNE') return 'GAGNE';
  if (t === OPPORTUNITY_STAGES.LOST || t === 'PERDU') return 'PERDU';
  return 'EN_ATTENTE';
}
