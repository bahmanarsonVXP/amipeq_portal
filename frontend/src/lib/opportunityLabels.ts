import type { BadgeVariant } from '@/components/ui/Badge';

export function opportunityStageLabel(stage: string): string {
  const map: Record<string, string> = {
    DEVIS_ENVOYE: 'Devis envoyé',
    EN_ATTENTE: 'En attente',
    GAGNE: 'Gagné',
    PERDU: 'Perdu',
  };
  return map[stage] ?? stage;
}

export function opportunityStageBadgeVariant(stage: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    GAGNE: 'success',
    PERDU: 'danger',
    EN_ATTENTE: 'warning',
    DEVIS_ENVOYE: 'info',
  };
  return map[stage] ?? 'neutral';
}
