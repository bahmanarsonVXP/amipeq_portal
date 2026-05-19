import type { BadgeVariant } from '@/components/ui/Badge';
import { ACTIVE_OPPORTUNITY_STAGES, OPPORTUNITY_STAGES, type OpportunityStageCode } from '@/lib/opportunityStages';

export { ACTIVE_OPPORTUNITY_STAGES, OPPORTUNITY_STAGES, type OpportunityStageCode };

export function isOpenOpportunityStage(stage: string | null | undefined): boolean {
  return stage != null && ACTIVE_OPPORTUNITY_STAGES.includes(stage as OpportunityStageCode);
}

export function opportunityStageLabel(stage: string): string {
  const map: Record<string, string> = {
    [OPPORTUNITY_STAGES.NEW]: 'Nouvelle',
    [OPPORTUNITY_STAGES.QUOTE_PREP]: 'Devis en cours',
    [OPPORTUNITY_STAGES.CLIENT_PENDING]: 'Attente retour client',
    [OPPORTUNITY_STAGES.FOLLOWUP]: 'Suivi client actif',
    [OPPORTUNITY_STAGES.STANDBY]: 'Standby / report',
    [OPPORTUNITY_STAGES.WON]: 'Gagné',
    [OPPORTUNITY_STAGES.LOST]: 'Perdu',
    NOUVEAU: 'Nouveau (ancien)',
    DEVIS_EN_COURS: 'Devis en cours (ancien)',
    DEVIS_EN_RELECTURE: 'Devis en relecture (ancien)',
    DEVIS_ENVOYE: 'Devis envoyé (ancien)',
    EN_ATTENTE: 'En attente',
    RELANCE: 'Relancé (ancien)',
    GAGNE: 'Gagné (ancien)',
    PERDU: 'Perdu (ancien)',
  };
  return map[stage] ?? stage;
}

export function opportunityStageBadgeVariant(stage: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    [OPPORTUNITY_STAGES.NEW]: 'warning',
    [OPPORTUNITY_STAGES.QUOTE_PREP]: 'info',
    [OPPORTUNITY_STAGES.CLIENT_PENDING]: 'info',
    [OPPORTUNITY_STAGES.FOLLOWUP]: 'warning',
    [OPPORTUNITY_STAGES.STANDBY]: 'neutral',
    [OPPORTUNITY_STAGES.WON]: 'success',
    [OPPORTUNITY_STAGES.LOST]: 'danger',
    NOUVEAU: 'warning',
    DEVIS_EN_COURS: 'info',
    DEVIS_EN_RELECTURE: 'info',
    RELANCE: 'warning',
    GAGNE: 'success',
    PERDU: 'danger',
    EN_ATTENTE: 'warning',
    DEVIS_ENVOYE: 'info',
  };
  return map[stage] ?? 'neutral';
}
