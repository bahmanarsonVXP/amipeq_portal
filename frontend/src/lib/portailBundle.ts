import type { PortailBundle, PortailQuote } from '@/types';
import { OPPORTUNITY_STAGES } from '@/lib/opportunityStages';

export function defaultPortailBundle(): PortailBundle {
  return {
    version: 1,
    pilotageId: null,
    quotes: [],
    standby: { active: false, until: null, reason: null },
    lastSentInitQuoteId: null,
  };
}

/**
 * Aligné sur gateway/src/lib/opportunityPortailBundle.ts (widgets + BC).
 */
export function getPilotQuote(bundle: PortailBundle): PortailQuote | null {
  if (!bundle.pilotageId) return bundle.quotes[0] ?? null;
  return bundle.quotes.find((q) => q.id === bundle.pilotageId) ?? null;
}

export function isTerminalStage(stage: string): boolean {
  return (
    stage === OPPORTUNITY_STAGES.WON ||
    stage === OPPORTUNITY_STAGES.LOST ||
    stage === 'GAGNE' ||
    stage === 'PERDU'
  );
}

export function bcMissing(
  bonDeCommandeRef: string | null | undefined,
  stage: string,
): boolean {
  if (stage !== OPPORTUNITY_STAGES.WON && stage !== 'GAGNE') return false;
  return !(bonDeCommandeRef && bonDeCommandeRef.trim().length > 0);
}

function matchesD1Finalisation(bundle: PortailBundle, stage: string): boolean {
  if (isTerminalStage(stage) || bundle.standby.active) return false;
  const p = getPilotQuote(bundle);
  if (!p) return false;
  return p.statut === 'Q_DRAFT_NEW' || p.statut === 'Q_INTERNAL_REVIEW';
}

function matchesW1ReadyToSend(bundle: PortailBundle, stage: string): boolean {
  if (isTerminalStage(stage) || bundle.standby.active) return false;
  const p = getPilotQuote(bundle);
  return p?.statut === 'Q_READY_TO_SEND';
}

function matchesD2Relecture(bundle: PortailBundle, stage: string): boolean {
  if (isTerminalStage(stage) || bundle.standby.active) return false;
  const p = getPilotQuote(bundle);
  return p?.statut === 'Q_INTERNAL_REVIEW';
}

function matchesD3AttenteClient(bundle: PortailBundle, stage: string): boolean {
  if (isTerminalStage(stage) || bundle.standby.active) return false;
  return (
    stage === OPPORTUNITY_STAGES.CLIENT_PENDING ||
    stage === OPPORTUNITY_STAGES.FOLLOWUP ||
    stage === 'DEVIS_ENVOYE' ||
    stage === 'RELANCE' ||
    getPilotQuote(bundle)?.statut === 'Q_SENT'
  );
}

export function legacyWidgetFlags(stage: string): {
  d1: boolean;
  w1: boolean;
  d2: boolean;
  d3: boolean;
} {
  if (
    stage === OPPORTUNITY_STAGES.WON ||
    stage === OPPORTUNITY_STAGES.LOST ||
    stage === 'GAGNE' ||
    stage === 'PERDU'
  ) {
    return { d1: false, w1: false, d2: false, d3: false };
  }
  if (stage === OPPORTUNITY_STAGES.STANDBY || stage === 'STANDBY' || stage === 'EN_ATTENTE') {
    return { d1: false, w1: false, d2: false, d3: false };
  }
  return {
    d1:
      stage === OPPORTUNITY_STAGES.QUOTE_PREP ||
      stage === 'DEVIS_EN_COURS' ||
      stage === 'DEVIS_EN_RELECTURE',
    w1: false,
    d2: false,
    d3:
      stage === OPPORTUNITY_STAGES.CLIENT_PENDING ||
      stage === OPPORTUNITY_STAGES.FOLLOWUP ||
      stage === 'DEVIS_ENVOYE' ||
      stage === 'RELANCE',
  };
}

export function effectiveWidgetFlags(
  bundle: PortailBundle,
  stage: string,
): { d1: boolean; w1: boolean; d2: boolean; d3: boolean } {
  if (bundle.quotes.length === 0) return legacyWidgetFlags(stage);
  return {
    d1: matchesD1Finalisation(bundle, stage),
    w1: matchesW1ReadyToSend(bundle, stage),
    d2: matchesD2Relecture(bundle, stage),
    d3: matchesD3AttenteClient(bundle, stage),
  };
}

export function quoteStatutLabel(s: PortailQuote['statut']): string {
  switch (s) {
    case 'Q_DRAFT_NEW':
      return 'Brouillon';
    case 'Q_INTERNAL_REVIEW':
      return 'Relecture interne';
    case 'Q_READY_TO_SEND':
      return 'Prêt à envoyer';
    case 'Q_SENT':
      return 'Envoyé';
    case 'Q_SUPERSEDED':
      return 'Remplacé';
    case 'Q_CANCELLED':
      return 'Annulé';
    default:
      return s;
  }
}

export function quoteCommercialLabel(s: PortailQuote['statutCommercial']): string {
  switch (s) {
    case 'GAGNE':
      return 'Gagné';
    case 'PERDU':
      return 'Perdu';
    default:
      return 'En attente';
  }
}

/** Aligné sur gateway `opportunityPortailBundle.isDocStatutFrozen`. */
export function isDocStatutFrozen(q: PortailQuote, bundle?: PortailBundle): boolean {
  if (q.statut !== 'Q_SENT') return false;
  if (!q.sentAt?.trim()) return false;
  if (!bundle || bundle.lastSentInitQuoteId == null) return false;
  return true;
}

export const REMISE_PRESETS = [0, 5, 10, 15, 20] as const;

export function calcMontantNet(brut: number, pct: number): number {
  const p = Math.max(0, Math.min(100, pct));
  return Math.round((brut * (1 - p / 100) + Number.EPSILON) * 100) / 100;
}
