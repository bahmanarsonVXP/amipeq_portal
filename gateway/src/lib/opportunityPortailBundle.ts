/**
 * Bundle multi-devis + pilotage (stocké JSON dans Twenty, champ `devisPortailBundle`).
 */

import { OPPORTUNITY_STAGES } from './opportunityStages';
import {
  amountMicrosToEur,
  calcMontantNetFromBrutAndPct,
  calcRemiseEurFromBrutAndNet,
  eurToAmountMicros,
  roundMoneyEur,
} from './quoteAmounts';

export type QuoteDocStatus =
  | 'Q_DRAFT_NEW'
  | 'Q_INTERNAL_REVIEW'
  | 'Q_READY_TO_SEND'
  | 'Q_SENT'
  | 'Q_SUPERSEDED'
  | 'Q_CANCELLED';

export type QuoteCommercialStatus = 'EN_ATTENTE' | 'GAGNE' | 'PERDU';

export interface PortailQuote {
  id: string;
  numero: string;
  label: string;
  statut: QuoteDocStatus;
  statutCommercial: QuoteCommercialStatus;
  sentAt: string | null;
  montantBrutEur: number | null;
  tauxRemise: number | null;
  montantNetEur: number | null;
  remiseTexte: string | null;
  prestations: string[];
  documentKey: string | null;
  documentFileName: string | null;
  documentUploadedAt: string | null;
}

export interface PortailStandby {
  active: boolean;
  until: string | null;
  reason: string | null;
}

export interface PortailBundle {
  version: number;
  pilotageId: string | null;
  quotes: PortailQuote[];
  standby: PortailStandby;
  lastSentInitQuoteId: string | null;
}

const EMPTY_STANDBY: PortailStandby = { active: false, until: null, reason: null };

const LETTER_SUFFIX_RE = /-[A-Z]$/;

export function defaultPortailBundle(): PortailBundle {
  return {
    version: 2,
    pilotageId: null,
    quotes: [],
    standby: { ...EMPTY_STANDBY },
    lastSentInitQuoteId: null,
  };
}

export function stripNumeroSuffix(numero: string): string {
  const t = numero.trim();
  if (LETTER_SUFFIX_RE.test(t)) return t.slice(0, -2);
  return t;
}

export function usedQuoteLetters(quotes: PortailQuote[]): Set<string> {
  const used = new Set<string>();
  for (const q of quotes) {
    const m = q.numero.trim().match(/-([A-Z])$/);
    if (m) used.add(m[1]!);
  }
  return used;
}

export function nextQuoteLetter(quotes: PortailQuote[]): string {
  const used = usedQuoteLetters(quotes);
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (!used.has(letter)) return letter;
  }
  throw new Error('Limite de 26 devis par opportunité atteinte.');
}

export function buildQuoteNumero(root: string, letter: string): string {
  const base = stripNumeroSuffix(root);
  return `${base}-${letter}`;
}

/**
 * Figé après envoi client via le portail (`mark-sent` → `sentAt` + `lastSentInitQuoteId`).
 * Les devis migrés en Q_SENT sans passage par mark-sent restent modifiables.
 */
export function isDocStatutFrozen(q: PortailQuote, bundle?: PortailBundle): boolean {
  if (q.statut !== 'Q_SENT') return false;
  if (!q.sentAt?.trim()) return false;
  if (!bundle || bundle.lastSentInitQuoteId == null) return false;
  return true;
}

export function normalizeQuoteAmounts(q: PortailQuote): PortailQuote {
  let brut = q.montantBrutEur;
  let taux = q.tauxRemise;
  if (brut != null && !Number.isFinite(brut)) brut = null;
  if (taux != null && !Number.isFinite(taux)) taux = null;
  if (brut == null || taux == null) {
    return { ...q, montantBrutEur: brut, tauxRemise: taux, montantNetEur: q.montantNetEur };
  }
  const net = calcMontantNetFromBrutAndPct(brut, taux);
  return { ...q, montantBrutEur: roundMoneyEur(brut), tauxRemise: taux, montantNetEur: net };
}

function parseQuoteRaw(q: Record<string, unknown>, fallbackNumero: string): PortailQuote | null {
  if (typeof q.id !== 'string' || !q.id) return null;
  const statut =
    typeof q.statut === 'string' ? (q.statut as QuoteDocStatus) : ('Q_DRAFT_NEW' as const);
  const statutCommercial =
    typeof q.statutCommercial === 'string'
      ? (q.statutCommercial as QuoteCommercialStatus)
      : ('EN_ATTENTE' as const);
  const prestations = Array.isArray(q.prestations)
    ? q.prestations.filter((p): p is string => typeof p === 'string')
    : [];
  const numero =
    typeof q.numero === 'string' && q.numero.trim()
      ? q.numero.trim()
      : fallbackNumero;
  const parsed: PortailQuote = {
    id: q.id,
    numero,
    label: typeof q.label === 'string' && q.label.trim() ? q.label.trim() : 'Devis',
    statut,
    statutCommercial,
    sentAt: typeof q.sentAt === 'string' ? q.sentAt : null,
    montantBrutEur: typeof q.montantBrutEur === 'number' ? q.montantBrutEur : null,
    tauxRemise: typeof q.tauxRemise === 'number' ? q.tauxRemise : null,
    montantNetEur: typeof q.montantNetEur === 'number' ? q.montantNetEur : null,
    remiseTexte: typeof q.remiseTexte === 'string' ? q.remiseTexte : null,
    prestations,
    documentKey: typeof q.documentKey === 'string' ? q.documentKey : null,
    documentFileName: typeof q.documentFileName === 'string' ? q.documentFileName : null,
    documentUploadedAt: typeof q.documentUploadedAt === 'string' ? q.documentUploadedAt : null,
  };
  return normalizeQuoteAmounts(parsed);
}

/** Rétro-compat v1 : label + statut + sentAt seulement. */
function upgradeV1Quote(
  q: { id: string; label?: string; statut: QuoteDocStatus; sentAt?: string | null },
  numero: string,
  record?: OpportunityRecordForLegacy,
): PortailQuote {
  const commercial = deriveCommercialFromOpportunity(record);
  const docStatut = deriveDocStatutFromOpportunity(record, q.statut);
  return normalizeQuoteAmounts({
    id: q.id,
    numero,
    label: q.label ?? 'Devis',
    statut: docStatut,
    statutCommercial: commercial,
    sentAt: q.sentAt ?? null,
    montantBrutEur: record?.montantBrutEur ?? null,
    tauxRemise: record?.tauxRemise ?? null,
    montantNetEur: record?.montantNetEur ?? null,
    remiseTexte: null,
    prestations: record?.prestations ?? [],
    documentKey: null,
    documentFileName: null,
    documentUploadedAt: null,
  });
}

export type OpportunityRecordForLegacy = {
  numeroDevis?: string | null;
  stage?: string;
  statutDevis?: string | null;
  montantBrutEur?: number | null;
  montantNetEur?: number | null;
  tauxRemise?: number | null;
  prestations?: string[];
};

export function deriveDocStatutFromOpportunity(
  record: OpportunityRecordForLegacy | undefined,
  current: QuoteDocStatus,
): QuoteDocStatus {
  if (current === 'Q_SENT' || current === 'Q_SUPERSEDED' || current === 'Q_CANCELLED') {
    return current;
  }
  const stage = record?.stage ?? '';
  const sd = record?.statutDevis ?? '';
  if (sd === 'GAGNE' || stage === OPPORTUNITY_STAGES.WON || stage === 'GAGNE') {
    return 'Q_SENT';
  }
  if (
    stage === OPPORTUNITY_STAGES.CLIENT_PENDING ||
    stage === OPPORTUNITY_STAGES.FOLLOWUP ||
    stage === 'DEVIS_ENVOYE' ||
    stage === 'RELANCE' ||
    sd === 'EN_ATTENTE'
  ) {
    return 'Q_SENT';
  }
  if (sd === 'PERDU' || stage === OPPORTUNITY_STAGES.LOST || stage === 'PERDU') {
    return 'Q_CANCELLED';
  }
  if (
    stage === OPPORTUNITY_STAGES.QUOTE_PREP ||
    stage === 'DEVIS_EN_RELECTURE'
  ) {
    return 'Q_INTERNAL_REVIEW';
  }
  return current;
}

export function deriveCommercialFromOpportunity(
  record: OpportunityRecordForLegacy | undefined,
): QuoteCommercialStatus {
  const sd = record?.statutDevis ?? '';
  if (sd === 'GAGNE') return 'GAGNE';
  if (sd === 'PERDU') return 'PERDU';
  return 'EN_ATTENTE';
}

/** ID stable pour le devis legacy synthétisé (bundle vide en base). */
export function legacyQuoteIdFromOpportunityId(opportunityId: string): string {
  return `legacy-${opportunityId}`;
}

export function parsePortailBundle(
  raw: string | null | undefined,
  legacyRecord?: OpportunityRecordForLegacy,
  opportunityId?: string,
): PortailBundle {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return legacyRecord
      ? ensureLegacyBundle(defaultPortailBundle(), legacyRecord, opportunityId)
      : defaultPortailBundle();
  }
  try {
    const o = JSON.parse(raw) as Partial<PortailBundle> & {
      quotes?: Array<Record<string, unknown>>;
    };
    if (!o || typeof o !== 'object') return defaultPortailBundle();

    const root =
      legacyRecord?.numeroDevis?.trim() ?
        stripNumeroSuffix(legacyRecord.numeroDevis)
      : 'DEVIS';

    const version = typeof o.version === 'number' ? o.version : 1;
    const rawQuotes = Array.isArray(o.quotes) ? o.quotes : [];

    let quotes: PortailQuote[];
    if (version < 2) {
      quotes = rawQuotes
        .filter((q) => q && typeof q.id === 'string')
        .map((q, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const numero = buildQuoteNumero(root, letter);
          return upgradeV1Quote(
            {
              id: q.id as string,
              label: typeof q.label === 'string' ? q.label : undefined,
              statut: q.statut as QuoteDocStatus,
              sentAt: typeof q.sentAt === 'string' ? q.sentAt : null,
            },
            numero,
            legacyRecord,
          );
        });
    } else {
      quotes = rawQuotes
        .map((q, idx) =>
          parseQuoteRaw(
            q as unknown as Record<string, unknown>,
            buildQuoteNumero(root, String.fromCharCode(65 + idx)),
          ),
        )
        .filter((q): q is PortailQuote => q !== null);
    }

    const standby =
      o.standby && typeof o.standby === 'object'
        ? {
            active: Boolean((o.standby as PortailStandby).active),
            until:
              typeof (o.standby as PortailStandby).until === 'string'
                ? (o.standby as PortailStandby).until
                : null,
            reason:
              typeof (o.standby as PortailStandby).reason === 'string'
                ? (o.standby as PortailStandby).reason
                : null,
          }
        : { ...EMPTY_STANDBY };

    const bundle: PortailBundle = {
      version: 2,
      pilotageId: typeof o.pilotageId === 'string' ? o.pilotageId : quotes[0]?.id ?? null,
      quotes,
      standby,
      lastSentInitQuoteId:
        typeof o.lastSentInitQuoteId === 'string' ? o.lastSentInitQuoteId : null,
    };

    if (bundle.quotes.length === 0 && legacyRecord) {
      return ensureLegacyBundle(bundle, legacyRecord, opportunityId);
    }
    return bundle;
  } catch {
    return legacyRecord
      ? ensureLegacyBundle(defaultPortailBundle(), legacyRecord, opportunityId)
      : defaultPortailBundle();
  }
}

export function ensureLegacyBundle(
  bundle: PortailBundle,
  record: OpportunityRecordForLegacy,
  opportunityId?: string,
): PortailBundle {
  if (bundle.quotes.length > 0) return bundle;
  const root = record.numeroDevis?.trim() ? stripNumeroSuffix(record.numeroDevis) : 'DEVIS';
  const id =
    opportunityId?.trim() ? legacyQuoteIdFromOpportunityId(opportunityId.trim()) : crypto.randomUUID();
  const commercial = deriveCommercialFromOpportunity(record);
  const docStatut = deriveDocStatutFromOpportunity(record, 'Q_DRAFT_NEW');
  const quote = normalizeQuoteAmounts({
    id,
    numero: buildQuoteNumero(root, 'A'),
    label: 'Devis',
    statut: docStatut,
    statutCommercial: commercial,
    sentAt: null,
    montantBrutEur: record.montantBrutEur ?? null,
    tauxRemise: record.tauxRemise ?? null,
    montantNetEur: record.montantNetEur ?? null,
    remiseTexte: null,
    prestations: record.prestations ?? [],
    documentKey: null,
    documentFileName: null,
    documentUploadedAt: null,
  });
  return {
    ...bundle,
    version: 2,
    pilotageId: id,
    quotes: [quote],
  };
}

export function createEmptyQuote(rootNumero: string, quotes: PortailQuote[], label: string): PortailQuote {
  const letter = nextQuoteLetter(quotes);
  return normalizeQuoteAmounts({
    id: crypto.randomUUID(),
    numero: buildQuoteNumero(rootNumero, letter),
    label: label.trim() || `Devis ${letter}`,
    statut: 'Q_DRAFT_NEW',
    statutCommercial: 'EN_ATTENTE',
    sentAt: null,
    montantBrutEur: null,
    tauxRemise: null,
    montantNetEur: null,
    remiseTexte: null,
    prestations: [],
    documentKey: null,
    documentFileName: null,
    documentUploadedAt: null,
  });
}

export function applyWonCommercialStatuses(
  bundle: PortailBundle,
  wonQuoteId: string,
): PortailBundle {
  return {
    ...bundle,
    pilotageId: wonQuoteId,
    quotes: bundle.quotes.map((q) => ({
      ...q,
      statutCommercial: q.id === wonQuoteId ? 'GAGNE' : 'PERDU',
    })),
  };
}

export function applyLostCommercialStatuses(bundle: PortailBundle): PortailBundle {
  return {
    ...bundle,
    quotes: bundle.quotes.map((q) => ({
      ...q,
      statutCommercial: 'PERDU',
    })),
  };
}

export function stringifyPortailBundle(b: PortailBundle): string {
  return JSON.stringify({ ...b, version: 2 });
}

export function getPilotQuote(bundle: PortailBundle): PortailQuote | null {
  if (!bundle.pilotageId) return bundle.quotes[0] ?? null;
  return bundle.quotes.find((q) => q.id === bundle.pilotageId) ?? null;
}

/** Champs opportunité Twenty à synchroniser depuis le devis pilotage (GraphQL updateOpportunity). */
export function pilotSyncPatchFromQuote(q: PortailQuote): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    prestation: q.prestations,
  };
  const net = q.montantNetEur;
  const brut = q.montantBrutEur;
  if (net != null && Number.isFinite(net)) {
    patch.amount = { amountMicros: eurToAmountMicros(net), currencyCode: 'EUR' };
  }
  if (brut != null && net != null && Number.isFinite(brut) && Number.isFinite(net)) {
    const remiseEur = calcRemiseEurFromBrutAndNet(brut, net);
    patch.montantRemise = { amountMicros: eurToAmountMicros(remiseEur), currencyCode: 'EUR' };
  } else {
    patch.montantRemise = { amountMicros: 0, currencyCode: 'EUR' };
  }
  patch.tauxRemise = q.tauxRemise ?? 0;
  patch.numeroDevis = stripNumeroSuffix(q.numero);
  return patch;
}

export function opportunityAmountsFromRecord(record: Record<string, unknown>): OpportunityRecordForLegacy {
  const microsRaw = (record.amount as { amountMicros?: string | number } | undefined)?.amountMicros;
  const micros =
    typeof microsRaw === 'string' ? parseInt(microsRaw, 10) : typeof microsRaw === 'number' ? microsRaw : null;
  const netEur = micros != null && Number.isFinite(micros) ? amountMicrosToEur(micros) : null;

  const remiseRaw = (record.montantRemise as { amountMicros?: string | number } | undefined)?.amountMicros;
  const remiseMicros =
    typeof remiseRaw === 'string'
      ? parseInt(remiseRaw, 10)
      : typeof remiseRaw === 'number'
        ? remiseRaw
        : null;
  const remiseEur =
    remiseMicros != null && Number.isFinite(remiseMicros) ? amountMicrosToEur(remiseMicros) : null;

  const brutEur =
    netEur != null && remiseEur != null ? roundMoneyEur(netEur + remiseEur) : netEur;

  const prestation = Array.isArray(record.prestation)
    ? record.prestation.filter((p): p is string => typeof p === 'string')
    : [];

  return {
    numeroDevis: typeof record.numeroDevis === 'string' ? record.numeroDevis : null,
    stage: typeof record.stage === 'string' ? record.stage : undefined,
    statutDevis: typeof record.statutDevis === 'string' ? record.statutDevis : null,
    montantBrutEur: brutEur,
    montantNetEur: netEur,
    tauxRemise: typeof record.tauxRemise === 'number' ? record.tauxRemise : null,
    prestations: prestation,
  };
}

export function mirrorStageFromPilot(pilot: PortailQuote | null): string {
  if (!pilot) return OPPORTUNITY_STAGES.NEW;
  if (pilot.statutCommercial === 'GAGNE') return OPPORTUNITY_STAGES.WON;
  if (pilot.statutCommercial === 'PERDU') return OPPORTUNITY_STAGES.LOST;
  switch (pilot.statut) {
    case 'Q_INTERNAL_REVIEW':
    case 'Q_DRAFT_NEW':
    case 'Q_READY_TO_SEND':
    case 'Q_SUPERSEDED':
    case 'Q_CANCELLED':
      return OPPORTUNITY_STAGES.QUOTE_PREP;
    case 'Q_SENT':
      return OPPORTUNITY_STAGES.CLIENT_PENDING;
    default:
      return OPPORTUNITY_STAGES.QUOTE_PREP;
  }
}

export function isTerminalStage(stage: string): boolean {
  return (
    stage === OPPORTUNITY_STAGES.WON ||
    stage === OPPORTUNITY_STAGES.LOST ||
    stage === 'GAGNE' ||
    stage === 'PERDU'
  );
}

export function bcMissing(bonDeCommandeRef: string | null | undefined, stage: string): boolean {
  if (stage !== OPPORTUNITY_STAGES.WON && stage !== 'GAGNE') return false;
  return !(bonDeCommandeRef && bonDeCommandeRef.trim().length > 0);
}

export function matchesD1Finalisation(bundle: PortailBundle, stage: string): boolean {
  if (isTerminalStage(stage) || bundle.standby.active) return false;
  const p = getPilotQuote(bundle);
  if (!p || isDocStatutFrozen(p, bundle)) return false;
  return p.statut === 'Q_DRAFT_NEW' || p.statut === 'Q_INTERNAL_REVIEW';
}

export function matchesW1ReadyToSend(bundle: PortailBundle, stage: string): boolean {
  if (isTerminalStage(stage) || bundle.standby.active) return false;
  const p = getPilotQuote(bundle);
  if (!p || isDocStatutFrozen(p, bundle)) return false;
  return p.statut === 'Q_READY_TO_SEND';
}

export function matchesD2Relecture(bundle: PortailBundle, stage: string): boolean {
  if (isTerminalStage(stage) || bundle.standby.active) return false;
  const p = getPilotQuote(bundle);
  if (!p || isDocStatutFrozen(p, bundle)) return false;
  return p.statut === 'Q_INTERNAL_REVIEW';
}

export function matchesD3AttenteClient(bundle: PortailBundle, stage: string): boolean {
  if (isTerminalStage(stage) || bundle.standby.active) return false;
  const p = getPilotQuote(bundle);
  return (
    stage === OPPORTUNITY_STAGES.CLIENT_PENDING ||
    stage === OPPORTUNITY_STAGES.FOLLOWUP ||
    stage === 'DEVIS_ENVOYE' ||
    stage === 'RELANCE' ||
    p?.statut === 'Q_SENT'
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

export function supersedeOtherSentQuotes(bundle: PortailBundle, pilotId: string): PortailBundle {
  return {
    ...bundle,
    quotes: bundle.quotes.map((q) => {
      if (q.id === pilotId) return q;
      if (q.statut === 'Q_SENT') return { ...q, statut: 'Q_SUPERSEDED' as const };
      return q;
    }),
  };
}

export function commercialStatusLabel(s: QuoteCommercialStatus): string {
  switch (s) {
    case 'GAGNE':
      return 'Gagné';
    case 'PERDU':
      return 'Perdu';
    default:
      return 'En attente';
  }
}
