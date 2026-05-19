import * as Portail from '../opportunityPortailBundle';
import { toGraphqlEnumValue } from '../opportunityGraphql';
import { calcMontantNetFromBrutAndPct } from '../quoteAmounts';

export type QuotePatchBody = {
  statut?: string;
  label?: string;
  montantBrutEur?: number | null;
  tauxRemise?: number | null;
  remiseTexte?: string | null;
  prestations?: string[];
};

function quoteLabelFr(s: Portail.QuoteDocStatus): string {
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

const QUOTE_PATCH_ALLOWED: Record<Portail.QuoteDocStatus, Portail.QuoteDocStatus[]> = {
  Q_DRAFT_NEW: ['Q_INTERNAL_REVIEW', 'Q_READY_TO_SEND', 'Q_CANCELLED'],
  Q_INTERNAL_REVIEW: ['Q_DRAFT_NEW', 'Q_READY_TO_SEND', 'Q_CANCELLED'],
  Q_READY_TO_SEND: ['Q_DRAFT_NEW', 'Q_CANCELLED'],
  Q_SENT: ['Q_CANCELLED'],
  Q_SUPERSEDED: [],
  Q_CANCELLED: [],
};

export function applyQuotePatch(
  q: Portail.PortailQuote,
  body: QuotePatchBody,
  bundle?: Portail.PortailBundle,
): Portail.PortailQuote {
  let next = { ...q };
  if (typeof body.label === 'string' && body.label.trim()) {
    next.label = body.label.trim();
  }
  if (body.remiseTexte !== undefined) {
    next.remiseTexte =
      body.remiseTexte == null || !String(body.remiseTexte).trim()
        ? null
        : String(body.remiseTexte).trim();
  }
  if (Array.isArray(body.prestations)) {
    next.prestations = body.prestations
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      .map((p) => toGraphqlEnumValue(p, 'prestation'));
  }
  if (body.montantBrutEur !== undefined) {
    next.montantBrutEur =
      body.montantBrutEur == null || Number.isNaN(Number(body.montantBrutEur))
        ? null
        : Number(body.montantBrutEur);
  }
  if (body.tauxRemise !== undefined) {
    next.tauxRemise =
      body.tauxRemise == null || Number.isNaN(Number(body.tauxRemise)) ? null : Number(body.tauxRemise);
  }
  if (next.montantBrutEur != null && next.tauxRemise != null) {
    next.montantNetEur = calcMontantNetFromBrutAndPct(next.montantBrutEur, next.tauxRemise);
  }
  if (typeof body.statut === 'string' && body.statut.trim()) {
    const nextStatut = body.statut.trim() as Portail.QuoteDocStatus;
    if (!Portail.isDocStatutFrozen(next, bundle) && nextStatut !== next.statut) {
      if (nextStatut === 'Q_SENT') {
        throw new Error('Utilisez POST …/mark-sent pour passer en « envoyé ».');
      }
      let allowed = QUOTE_PATCH_ALLOWED[next.statut];
      if (
        next.statut === 'Q_SENT' &&
        !Portail.isDocStatutFrozen(next, bundle)
      ) {
        allowed = ['Q_DRAFT_NEW', 'Q_INTERNAL_REVIEW', 'Q_READY_TO_SEND', 'Q_CANCELLED'];
      }
      if (!allowed?.includes(nextStatut)) {
        throw new Error(
          `Transition interdite : ${quoteLabelFr(next.statut)} → ${quoteLabelFr(nextStatut)}.`,
        );
      }
      const wasSent = next.statut === 'Q_SENT';
      next.statut = nextStatut;
      if (wasSent) {
        next.sentAt = null;
      }
    }
  }
  return Portail.normalizeQuoteAmounts(next);
}
