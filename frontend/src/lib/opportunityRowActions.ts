import { getPilotQuote } from '@/lib/portailBundle';
import { mapLegacyStageToOpp, OPPORTUNITY_STAGES } from '@/lib/opportunityStages';
import type { OpportunityRow } from '@/types';

export type RowActionButtonVariant = 'primary' | 'success' | 'danger' | 'neutral' | 'info';

export type OpportunityRowActionKind =
  | { type: 'stage'; stage: string; label: string; variant?: RowActionButtonVariant }
  | { type: 'open-devis-create'; label: string }
  | { type: 'open-devis-pilot'; label: string; quoteId: string | null }
  | { type: 'open-drawer'; label: string }
  | { type: 'duerp'; label: string };

function normalizedStage(stage: string): string {
  return mapLegacyStageToOpp(stage) ?? stage;
}

/** Actions rapides de la liste opportunités selon le statut courant. */
export function getOpportunityRowActions(
  opportunity: OpportunityRow,
): OpportunityRowActionKind[] {
  const stage = normalizedStage(opportunity.stage);
  const bundle = opportunity.portailBundle;
  const pilot = getPilotQuote(bundle);

  switch (stage) {
    case OPPORTUNITY_STAGES.NEW:
      return [{ type: 'open-devis-create', label: 'Créer Devis' }];

    case OPPORTUNITY_STAGES.QUOTE_PREP:
      return [
        {
          type: 'open-devis-pilot',
          label: 'Voir devis en cours',
          quoteId: pilot?.id ?? null,
        },
      ];

    case OPPORTUNITY_STAGES.CLIENT_PENDING:
      return [
        { type: 'stage', stage: OPPORTUNITY_STAGES.WON, label: 'Gagné', variant: 'success' },
        { type: 'stage', stage: OPPORTUNITY_STAGES.LOST, label: 'Perdu', variant: 'danger' },
        { type: 'stage', stage: OPPORTUNITY_STAGES.STANDBY, label: 'Standby', variant: 'neutral' },
      ];

    case OPPORTUNITY_STAGES.FOLLOWUP:
      return [
        { type: 'stage', stage: OPPORTUNITY_STAGES.WON, label: 'Gagné', variant: 'success' },
        { type: 'stage', stage: OPPORTUNITY_STAGES.LOST, label: 'Perdu', variant: 'danger' },
      ];

    case OPPORTUNITY_STAGES.STANDBY:
      return [
        { type: 'stage', stage: OPPORTUNITY_STAGES.WON, label: 'Gagné', variant: 'success' },
        { type: 'stage', stage: OPPORTUNITY_STAGES.LOST, label: 'Perdu', variant: 'danger' },
      ];

    case OPPORTUNITY_STAGES.WON:
    case 'GAGNE':
      return [{ type: 'duerp', label: 'Envoyer DUERP' }];

    case OPPORTUNITY_STAGES.LOST:
    case 'PERDU':
      return [{ type: 'open-drawer', label: 'Voir détail' }];

    default:
      return [];
  }
}

export function rowActionButtonClass(variant: RowActionButtonVariant = 'neutral'): string {
  const base =
    'rounded-md border px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50';
  switch (variant) {
    case 'success':
      return `${base} border-green-300 text-green-700 hover:bg-green-50`;
    case 'danger':
      return `${base} border-red-300 text-red-700 hover:bg-red-50`;
    case 'info':
      return `${base} border-blue-200 text-blue-700 hover:bg-blue-50`;
    case 'primary':
      return `${base} border-primary-300 text-primary-800 hover:bg-primary-50`;
    default:
      return `${base} border-gray-200 text-gray-600 hover:bg-gray-50`;
  }
}
