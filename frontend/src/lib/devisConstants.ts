import type { PortailQuote, PortailQuoteDocStatus } from '@/types';

export const PRESTATION_OPTIONS = [
  'DU',
  'MAJ_DU',
  'MAJ_DU_DEMAT',
  'DUERP',
  'MAJ_DUERP',
  'MAJ_DU_DISTANCE',
  'DU_SITE_DISTANCE',
  'PPMS',
  'MAJ_PPMS',
  'DU_DISTANCE',
  'RPS',
  'RPS_ENTRETIENS',
  'RPS_ET_ENTRETIENS',
] as const;

export const PRESTATION_LABELS: Record<string, string> = {
  DU: 'DU',
  MAJ_DU: 'MAJ DU',
  MAJ_DU_DEMAT: 'MAJ DU Démat.',
  DUERP: 'DUERP',
  MAJ_DUERP: 'MAJ DUERP',
  MAJ_DU_DISTANCE: 'MAJ DU à Distance',
  DU_SITE_DISTANCE: 'DU Sur SITE ou à DISTANCE',
  PPMS: 'PPMS',
  MAJ_PPMS: 'MAJ PPMS',
  DU_DISTANCE: 'DU à Distance',
  RPS: 'RPS',
  RPS_ENTRETIENS: 'RPS avec Entretiens',
  RPS_ET_ENTRETIENS: 'RPS et/ou Entretiens',
};

export const QUOTE_STATUT_SELECT: Record<PortailQuoteDocStatus, PortailQuoteDocStatus[]> = {
  Q_DRAFT_NEW: ['Q_DRAFT_NEW', 'Q_INTERNAL_REVIEW', 'Q_READY_TO_SEND', 'Q_CANCELLED'],
  Q_INTERNAL_REVIEW: ['Q_INTERNAL_REVIEW', 'Q_DRAFT_NEW', 'Q_READY_TO_SEND', 'Q_CANCELLED'],
  Q_READY_TO_SEND: ['Q_READY_TO_SEND', 'Q_DRAFT_NEW', 'Q_CANCELLED'],
  Q_SENT: ['Q_SENT'],
  Q_SUPERSEDED: ['Q_SUPERSEDED'],
  Q_CANCELLED: ['Q_CANCELLED'],
};

/** Devis Q_SENT migré (sans envoi portail) : retour possible en préparation. */
export const QUOTE_STATUT_SELECT_INFERRED_SENT: PortailQuoteDocStatus[] = [
  'Q_DRAFT_NEW',
  'Q_INTERNAL_REVIEW',
  'Q_READY_TO_SEND',
  'Q_CANCELLED',
];

export function quoteStatutSelectOptions(
  statut: PortailQuoteDocStatus,
  inferredSent: boolean,
): PortailQuoteDocStatus[] {
  if (statut === 'Q_SENT' && inferredSent) {
    return QUOTE_STATUT_SELECT_INFERRED_SENT;
  }
  return QUOTE_STATUT_SELECT[statut] ?? [statut];
}

export function formatPrestationsSummary(prestations: string[]): string {
  if (!prestations.length) return '—';
  return prestations.map((p) => PRESTATION_LABELS[p] ?? p).join(' + ');
}

export function quoteDisplayStatusLabel(q: PortailQuote): string {
  if (q.statut === 'Q_SENT') {
    if (q.statutCommercial === 'GAGNE') return 'Gagné';
    if (q.statutCommercial === 'PERDU') return 'Perdu';
    return 'En attente';
  }
  const labels: Record<PortailQuoteDocStatus, string> = {
    Q_DRAFT_NEW: 'Brouillon',
    Q_INTERNAL_REVIEW: 'Relecture',
    Q_READY_TO_SEND: 'Prêt à envoyer',
    Q_SENT: 'Envoyé',
    Q_SUPERSEDED: 'Remplacé',
    Q_CANCELLED: 'Annulé',
  };
  return labels[q.statut] ?? q.statut;
}
